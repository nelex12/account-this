using System.Text.Json;
using AccountThis.Shared.Events;
using Npgsql;
using RabbitMQ.Client;

namespace AccountThis.Api.Events;

// Отправка событий из outbox_events в RabbitMQ (docs/events.md, «Издатель»). Фоновая служба API.
// Будит её NOTIFY после COMMIT транзакции с событием; раз в PollInterval она проверяет outbox и без сигнала —
// так отправляются события, оставшиеся после остановки приложения или недоступности брокера.
// Запись удаляется только после подтверждения брокера (publisher confirms): доставка «хотя бы один раз».
// HTTP-запросы от брокера не зависят: брокер недоступен — события копятся в outbox и уходят, когда он вернётся.
public sealed class OutboxDispatcher(
    NpgsqlDataSource dataSource,
    IConfiguration configuration,
    ILogger<OutboxDispatcher> logger) : BackgroundService
{
    private const int BatchSize = 100;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    private IConnection? _connection;
    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Не задерживать старт приложения подключением к БД и брокеру
        await Task.Yield();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var listener = await dataSource.OpenConnectionAsync(stoppingToken);
                await using (var cmd = new NpgsqlCommand($"LISTEN {EventOutbox.NotifyChannel}", listener))
                {
                    await cmd.ExecuteNonQueryAsync(stoppingToken);
                }

                while (!stoppingToken.IsCancellationRequested)
                {
                    // Сначала всё накопленное, потом ждать сигнала. NOTIFY, пришедший во время отправки,
                    // не теряется: он ждёт в соединении, и WaitAsync сразу вернётся
                    await DispatchPendingAsync(stoppingToken);
                    await listener.WaitAsync(PollInterval, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Отправка событий из outbox прервана, повтор через {Delay}", RetryDelay);
                await CloseBrokerAsync();
                try
                {
                    await Task.Delay(RetryDelay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        await CloseBrokerAsync();
    }

    private async Task DispatchPendingAsync(CancellationToken cancellationToken)
    {
        while (await DispatchBatchAsync(cancellationToken) == BatchSize)
        {
        }
    }

    // Пачка в одной транзакции: прочитать, отправить, удалить отправленное. Сбой в середине — откат,
    // пачка будет отправлена снова целиком (потребители отсекают повтор по eventId).
    // FOR UPDATE SKIP LOCKED: несколько экземпляров API не отправляют одну запись одновременно
    private async Task<int> DispatchBatchAsync(CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

        var ids = new List<long>();
        var messages = new List<EventMessage>();
        await using (var cmd = new NpgsqlCommand(
            "SELECT id, event_id, type, company_id, actor_id, occurred_at, data::text FROM outbox_events " +
            "ORDER BY id LIMIT @limit FOR UPDATE SKIP LOCKED",
            conn,
            transaction))
        {
            cmd.Parameters.AddWithValue("limit", BatchSize);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                using var data = JsonDocument.Parse(reader.GetString(6));
                ids.Add(reader.GetInt64(0));
                messages.Add(new EventMessage
                {
                    EventId = reader.GetGuid(1),
                    Type = reader.GetString(2),
                    CompanyId = reader.GetGuid(3),
                    ActorId = reader.GetGuid(4),
                    OccurredAt = reader.GetInt64(5),
                    Data = data.RootElement.Clone(),
                });
            }
        }

        if (ids.Count == 0)
        {
            return 0;
        }

        var channel = await GetChannelAsync(cancellationToken);
        foreach (var message in messages)
        {
            var properties = new BasicProperties
            {
                ContentType = "application/json",
                DeliveryMode = DeliveryModes.Persistent,
                MessageId = message.EventId.ToString(),
                Type = message.Type,
            };

            // С отслеживанием подтверждений вызов завершается, когда брокер принял сообщение (или бросает при отказе)
            await channel.BasicPublishAsync(RabbitMqTopology.Exchange, message.Type, mandatory: false, properties,
                message.ToUtf8Bytes(), cancellationToken);
        }

        await using (var cmd = new NpgsqlCommand("DELETE FROM outbox_events WHERE id = ANY(@ids)", conn, transaction))
        {
            cmd.Parameters.AddWithValue("ids", ids.ToArray());
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return ids.Count;
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        await CloseBrokerAsync();
        var factory = RabbitMqTopology.CreateFactory(configuration, "accountthis-api-outbox");
        _connection = await factory.CreateConnectionAsync(cancellationToken);
        _channel = await _connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            cancellationToken);
        await RabbitMqTopology.DeclareAsync(_channel, cancellationToken);
        return _channel;
    }

    private async Task CloseBrokerAsync()
    {
        try
        {
            if (_channel is not null)
            {
                await _channel.DisposeAsync();
            }

            if (_connection is not null)
            {
                await _connection.DisposeAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Ошибка при закрытии соединения с RabbitMQ");
        }
        finally
        {
            _channel = null;
            _connection = null;
        }
    }
}
