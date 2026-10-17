using System.Text.Json;
using AccountThis.Shared.Events;
using Npgsql;
using NpgsqlTypes;

namespace AccountThis.Api.Events;

// Transactional outbox (docs/events.md, «Издатель»): сервис записывает событие в outbox_events в своей транзакции,
// до COMMIT. Откатилось изменение — откатилось и событие; зафиксировано — событие точно будет отправлено
// (OutboxDispatcher). Вызывать только при реальном изменении состояния.
public interface IEventOutbox
{
    Task AddAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string type, Guid companyId, Guid actorId, object data, CancellationToken cancellationToken);
}

public sealed class EventOutbox(TimeProvider timeProvider) : IEventOutbox
{
    // Канал LISTEN/NOTIFY: PostgreSQL доставляет NOTIFY только после COMMIT, поэтому диспетчер не увидит сигнал раньше строки
    public const string NotifyChannel = "outbox_events";

    public async Task AddAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string type, Guid companyId, Guid actorId, object data, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO outbox_events (event_id, type, company_id, actor_id, occurred_at, data) " +
            "VALUES (@eventId, @type, @companyId, @actorId, @occurredAt, @data); " +
            $"NOTIFY {NotifyChannel}",
            connection,
            transaction);
        cmd.Parameters.AddWithValue("eventId", Guid.NewGuid());
        cmd.Parameters.AddWithValue("type", type);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("actorId", actorId);
        cmd.Parameters.AddWithValue("occurredAt", timeProvider.GetUtcNow().ToUnixTimeSeconds());
        cmd.Parameters.Add(new NpgsqlParameter("data", NpgsqlDbType.Jsonb)
        {
            Value = JsonSerializer.Serialize(data, EventMessage.JsonOptions),
        });
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
}
