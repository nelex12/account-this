using AccountThis.Shared.Events;
using Npgsql;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AccountThis.Worker;

// Общая часть потребителей (docs/events.md, «Потребители»): подключение к своей очереди с переподключением,
// разбор конверта, подтверждение вручную после обработки. Наследник реализует только обработку события.
// Повторная доставка возможна (сбой до ack, повторная отправка из outbox), поэтому обработка должна быть идемпотентной.
public abstract class EventConsumer(IConfiguration configuration, ILogger logger) : BackgroundService
{
    private const ushort Prefetch = 10;
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan DatabaseRetryDelay = TimeSpan.FromSeconds(1);

    protected abstract string Queue { get; }

    // false — событие не по контракту своего типа (нет нужных полей): сообщение уходит в очередь отказов
    protected abstract Task<bool> HandleAsync(EventMessage message, CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Не задерживать старт приложения подключением к брокеру
        await Task.Yield();

        while (!stoppingToken.IsCancellationRequested)
        {
            IConnection? connection = null;
            IChannel? channel = null;
            try
            {
                var factory = RabbitMqTopology.CreateFactory(configuration, $"accountthis-worker-{Queue}");
                connection = await factory.CreateConnectionAsync(stoppingToken);
                channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
                await RabbitMqTopology.DeclareAsync(channel, stoppingToken);
                await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: Prefetch, global: false, stoppingToken);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += (_, delivery) => OnReceivedAsync(channel, delivery, stoppingToken);
                await channel.BasicConsumeAsync(Queue, autoAck: false, consumer, stoppingToken);

                logger.LogInformation("Потребитель очереди {Queue} подключён к RabbitMQ", Queue);

                // Дальше работает сам клиент (в том числе восстанавливает соединение после обрыва)
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Очередь {Queue}: нет подключения к RabbitMQ, повтор через {Delay}", Queue, ReconnectDelay);
                await DisposeAsync(channel, connection);
                channel = null;
                connection = null;
                try
                {
                    await Task.Delay(ReconnectDelay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
            finally
            {
                await DisposeAsync(channel, connection);
            }
        }
    }

    private async Task OnReceivedAsync(IChannel channel, BasicDeliverEventArgs delivery, CancellationToken stoppingToken)
    {
        if (!EventMessage.TryParse(delivery.Body, out var message))
        {
            await RejectAsync(channel, delivery, "не разобрано как событие");
            return;
        }

        bool handled;
        try
        {
            handled = await HandleAsync(message, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Без ack: при закрытии канала брокер вернёт сообщение в очередь
            return;
        }
        catch (PostgresException ex) when (IsDataError(ex))
        {
            // Повтор не поможет: те же данные снова нарушат то же ограничение
            logger.LogWarning(ex, "Событие {EventId} отклонено БД", message.EventId);
            await RejectAsync(channel, delivery, "отклонено БД");
            return;
        }
        catch (Exception ex) when (ex is NpgsqlException or TimeoutException)
        {
            logger.LogWarning(ex, "Очередь {Queue}: событие {EventId} не обработано, возвращено в очередь", Queue, message.EventId);
            await Task.Delay(DatabaseRetryDelay, CancellationToken.None);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true);
            return;
        }
        catch (Exception ex)
        {
            // Ошибка в коде обработчика: без ack/nack сообщение осталось бы неподтверждённым и занимало место prefetch
            logger.LogError(ex, "Очередь {Queue}: событие {EventId} не обработано из-за ошибки", Queue, message.EventId);
            await RejectAsync(channel, delivery, "не обработано из-за ошибки");
            return;
        }

        if (!handled)
        {
            await RejectAsync(channel, delivery, $"событие {message.Type} без нужных полей");
            return;
        }

        await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
    }

    // Отказ без возврата в очередь: сообщение уходит в events.dead (x-dead-letter-exchange очереди)
    private async Task RejectAsync(IChannel channel, BasicDeliverEventArgs delivery, string reason)
    {
        logger.LogWarning("Очередь {Queue}: сообщение {MessageId} {Reason}, отправлено в {DeadLetterQueue}",
            Queue, delivery.BasicProperties.MessageId, reason, RabbitMqTopology.DeadLetterQueue);
        await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false);
    }

    // Класс 22 — неверные данные, 23 — нарушение ограничения. Остальное (нет связи, нет таблицы до миграций) — временное
    private static bool IsDataError(PostgresException ex) =>
        ex.SqlState.StartsWith("22", StringComparison.Ordinal) || ex.SqlState.StartsWith("23", StringComparison.Ordinal);

    private async Task DisposeAsync(IChannel? channel, IConnection? connection)
    {
        try
        {
            if (channel is not null)
            {
                await channel.DisposeAsync();
            }

            if (connection is not null)
            {
                await connection.DisposeAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Ошибка при закрытии соединения с RabbitMQ");
        }
    }
}
