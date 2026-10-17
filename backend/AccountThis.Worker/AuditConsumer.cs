using AccountThis.Shared.Events;
using Npgsql;
using NpgsqlTypes;

namespace AccountThis.Worker;

// Очередь audit (все события) → таблица audit_events (docs/events.md, «Потребитель audit»).
// Вставка идемпотентна: повторная доставка того же eventId строку не дублирует
public sealed class AuditConsumer(
    IConfiguration configuration,
    NpgsqlDataSource dataSource,
    ILogger<AuditConsumer> logger) : EventConsumer(configuration, logger)
{
    protected override string Queue => RabbitMqTopology.AuditQueue;

    protected override async Task<bool> HandleAsync(EventMessage message, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO audit_events (event_id, type, company_id, actor_id, occurred_at, data) " +
            "VALUES (@eventId, @type, @companyId, @actorId, @occurredAt, @data) " +
            "ON CONFLICT (event_id) DO NOTHING",
            conn);
        cmd.Parameters.AddWithValue("eventId", message.EventId);
        cmd.Parameters.AddWithValue("type", message.Type);
        cmd.Parameters.AddWithValue("companyId", message.CompanyId);
        cmd.Parameters.AddWithValue("actorId", message.ActorId);
        cmd.Parameters.AddWithValue("occurredAt", message.OccurredAt);
        cmd.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Jsonb) { Value = message.Data.GetRawText() });
        await cmd.ExecuteNonQueryAsync(cancellationToken);
        return true;
    }
}
