using System.Text.Json;
using AccountThis.Shared.Events;
using Npgsql;
using NpgsqlTypes;

namespace AccountThis.Worker;

// Очередь notifications → таблица notifications (docs/events.md, «Потребитель notifications»).
// Из потока событий выбирает то, что требует внимания Owner; API показывает это в GET /api/notifications.
// Подписка очереди — только на нужные типы (RabbitMqTopology.Queues), остальные сюда не приходят.
// Одно событие — не более одного уведомления (ON CONFLICT (event_id) DO NOTHING), поэтому повторная доставка безвредна
public sealed class NotificationsConsumer(
    IConfiguration configuration,
    NpgsqlDataSource dataSource,
    ILogger<NotificationsConsumer> logger) : EventConsumer(configuration, logger)
{
    // Значения notification_type в БД
    private const string EmployeeAwaitingApproval = "EmployeeAwaitingApproval";
    private const string SessionReuseDetected = "SessionReuseDetected";
    private const string SuspiciousSync = "SuspiciousSync";

    protected override string Queue => RabbitMqTopology.NotificationsQueue;

    protected override Task<bool> HandleAsync(EventMessage message, CancellationToken cancellationToken) => message.Type switch
    {
        EventTypes.UserRegistered => OnUserRegisteredAsync(message, cancellationToken),
        EventTypes.UserApproved or EventTypes.UserDeactivated => OnEmployeeDecidedAsync(message, cancellationToken),
        EventTypes.AuthSessionReuseDetected => InsertAsync(message, SessionReuseDetected, message.ActorId, null, cancellationToken),
        EventTypes.RentalSynced => OnRentalSyncedAsync(message, cancellationToken),
        _ => Task.FromResult(true),
    };

    // Сотрудник и завхоз ждут подтверждения Owner; Owner подтверждается сам, уведомлять не о чем
    private Task<bool> OnUserRegisteredAsync(EventMessage message, CancellationToken cancellationToken)
    {
        if (!TryGetGuid(message.Data, "userId", out var userId)
            || !message.Data.TryGetProperty("role", out var role) || role.ValueKind != JsonValueKind.String)
        {
            return Task.FromResult(false);
        }

        return role.GetString() == "Owner"
            ? Task.FromResult(true)
            : InsertAsync(message, EmployeeAwaitingApproval, userId, null, cancellationToken);
    }

    // Owner подтвердил или уволил пользователя — уведомление «ждёт подтверждения» больше не требует внимания
    private async Task<bool> OnEmployeeDecidedAsync(EventMessage message, CancellationToken cancellationToken)
    {
        if (!TryGetGuid(message.Data, "userId", out var userId))
        {
            return false;
        }

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "UPDATE notifications SET read_at = @occurredAt " +
            "WHERE company_id = @companyId AND user_id = @userId " +
            $"AND type = '{EmployeeAwaitingApproval}' AND read_at IS NULL",
            conn);
        cmd.Parameters.AddWithValue("occurredAt", message.OccurredAt);
        cmd.Parameters.AddWithValue("companyId", message.CompanyId);
        cmd.Parameters.AddWithValue("userId", userId);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
        return true;
    }

    // Записи с флагом, отличным от VALID: подделка подписи, просроченный сертификат, уволенный сотрудник, повтор QR...
    // Только новые записи (data.flags не учитывает повторную отправку), поэтому повтор синхронизации уведомление не дублирует
    private Task<bool> OnRentalSyncedAsync(EventMessage message, CancellationToken cancellationToken)
    {
        if (!message.Data.TryGetProperty("flags", out var flags) || flags.ValueKind != JsonValueKind.Object)
        {
            return Task.FromResult(false);
        }

        var suspicious = new Dictionary<string, int>();
        foreach (var flag in flags.EnumerateObject())
        {
            if (flag.Value.ValueKind != JsonValueKind.Number || !flag.Value.TryGetInt32(out var count))
            {
                return Task.FromResult(false);
            }

            if (flag.Name != "VALID" && count > 0)
            {
                suspicious[flag.Name] = count;
            }
        }

        return suspicious.Count == 0
            ? Task.FromResult(true)
            : InsertAsync(message, SuspiciousSync, message.ActorId, JsonSerializer.Serialize(suspicious), cancellationToken);
    }

    private async Task<bool> InsertAsync(
        EventMessage message, string type, Guid userId, string? flagsJson, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO notifications (event_id, company_id, type, user_id, flags, occurred_at) " +
            "VALUES (@eventId, @companyId, @type::notification_type, @userId, @flags, @occurredAt) " +
            "ON CONFLICT (event_id) DO NOTHING",
            conn);
        cmd.Parameters.AddWithValue("eventId", message.EventId);
        cmd.Parameters.AddWithValue("companyId", message.CompanyId);
        cmd.Parameters.AddWithValue("type", type);
        cmd.Parameters.AddWithValue("userId", userId);
        cmd.Parameters.Add(new NpgsqlParameter("flags", NpgsqlDbType.Jsonb) { Value = (object?)flagsJson ?? DBNull.Value });
        cmd.Parameters.AddWithValue("occurredAt", message.OccurredAt);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
        return true;
    }

    private static bool TryGetGuid(JsonElement data, string name, out Guid value)
    {
        value = Guid.Empty;
        return data.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            && property.TryGetGuid(out value);
    }
}
