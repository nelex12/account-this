using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AccountThis.Api.Events;

// Потребитель очереди audit → таблица audit_events (docs/events.md, «Потребитель audit»).
// Подтверждение вручную после записи в БД; вставка идемпотентна (ON CONFLICT (event_id) DO NOTHING).
// Неразбираемое сообщение — в audit.dead (nack без возврата), ошибка БД — обратно в очередь.
public sealed class AuditConsumer(
    IConfiguration configuration,
    NpgsqlDataSource dataSource,
    ILogger<AuditConsumer> logger) : BackgroundService
{
    private const ushort Prefetch = 10;
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan DatabaseRetryDelay = TimeSpan.FromSeconds(1);

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
                var factory = RabbitMqTopology.CreateFactory(configuration, "accountthis-api-audit-consumer");
                connection = await factory.CreateConnectionAsync(stoppingToken);
                channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
                await RabbitMqTopology.DeclareAsync(channel, stoppingToken);
                await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: Prefetch, global: false, stoppingToken);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += (_, delivery) => HandleAsync(channel, delivery);
                await channel.BasicConsumeAsync(RabbitMqTopology.AuditQueue, autoAck: false, consumer, stoppingToken);

                logger.LogInformation("Потребитель очереди {Queue} подключён к RabbitMQ", RabbitMqTopology.AuditQueue);

                // Дальше работает сам клиент (в том числе восстанавливает соединение после обрыва)
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Нет подключения к RabbitMQ, повтор через {Delay}", ReconnectDelay);
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

    private async Task HandleAsync(IChannel channel, BasicDeliverEventArgs delivery)
    {
        if (!TryParse(delivery.Body, out var auditEvent, out var dataJson))
        {
            logger.LogWarning("Сообщение {MessageId} не разобрано как событие аудита, отправлено в {Queue}",
                delivery.BasicProperties.MessageId, RabbitMqTopology.DeadLetterQueue);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false);
            return;
        }

        try
        {
            await InsertAsync(auditEvent, dataJson);
        }
        catch (Exception ex) when (ex is NpgsqlException or TimeoutException)
        {
            logger.LogWarning(ex, "Событие {EventId} не записано в БД, возвращено в очередь", auditEvent.EventId);
            await Task.Delay(DatabaseRetryDelay);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true);
            return;
        }

        await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
    }

    private async Task InsertAsync(AuditEvent auditEvent, string dataJson)
    {
        await using var conn = await dataSource.OpenConnectionAsync();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO audit_events (event_id, type, company_id, actor_id, occurred_at, data) " +
            "VALUES (@eventId, @type, @companyId, @actorId, @occurredAt, @data) " +
            "ON CONFLICT (event_id) DO NOTHING",
            conn);
        cmd.Parameters.AddWithValue("eventId", auditEvent.EventId);
        cmd.Parameters.AddWithValue("type", auditEvent.Type);
        cmd.Parameters.AddWithValue("companyId", auditEvent.CompanyId);
        cmd.Parameters.AddWithValue("actorId", auditEvent.ActorId);
        cmd.Parameters.AddWithValue("occurredAt", auditEvent.OccurredAt);
        cmd.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Jsonb) { Value = dataJson });
        await cmd.ExecuteNonQueryAsync();
    }

    // Все поля сообщения обязательны; data — JSON-объект
    private static bool TryParse(ReadOnlyMemory<byte> body, out AuditEvent auditEvent, out string dataJson)
    {
        auditEvent = new AuditEvent();
        dataJson = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("eventId", out var eventId) || eventId.ValueKind != JsonValueKind.String || !eventId.TryGetGuid(out var eventGuid)
                || !root.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String
                || !root.TryGetProperty("occurredAt", out var occurredAt) || occurredAt.ValueKind != JsonValueKind.Number || !occurredAt.TryGetInt64(out var occurredAtValue)
                || !root.TryGetProperty("companyId", out var companyId) || companyId.ValueKind != JsonValueKind.String || !companyId.TryGetGuid(out var companyGuid)
                || !root.TryGetProperty("actorId", out var actorId) || actorId.ValueKind != JsonValueKind.String || !actorId.TryGetGuid(out var actorGuid)
                || !root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var typeValue = type.GetString()!;
            if (typeValue.Length is 0 or > 64)
            {
                return false;
            }

            auditEvent = new AuditEvent
            {
                EventId = eventGuid,
                Type = typeValue,
                OccurredAt = occurredAtValue,
                CompanyId = companyGuid,
                ActorId = actorGuid,
            };
            dataJson = data.GetRawText();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

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
