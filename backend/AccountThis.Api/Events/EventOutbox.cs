using System.Text.Json;
using AccountThis.Shared.Events;
using Npgsql;
using NpgsqlTypes;

namespace AccountThis.Api.Events;

public interface IEventOutbox
{
    Task AddAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string type, Guid companyId, Guid actorId, object data, CancellationToken cancellationToken);
}

public sealed class EventOutbox(TimeProvider timeProvider) : IEventOutbox
{
    // PostgreSQL доставляет сигнал после COMMIT.
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
