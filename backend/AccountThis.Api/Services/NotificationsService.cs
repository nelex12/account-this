using System.Text.Json;
using AccountThis.Api.Models;
using Npgsql;

namespace AccountThis.Api.Services;

// Уведомления Owner (таблица notifications, её заполняет AccountThis.Worker). companyId — из JWT вызывающего:
// уведомление другой компании неотличимо от несуществующего
public interface INotificationsService
{
    // Не более Limit последних, новые сверху
    Task<List<Notification>> GetAsync(Guid companyId, CancellationToken cancellationToken);

    // false — не найдено; повторная отметка — true, момент прочтения не меняется
    Task<bool> MarkReadAsync(Guid companyId, long id, CancellationToken cancellationToken);
}

public class NotificationsService(NpgsqlDataSource dataSource, TimeProvider timeProvider) : INotificationsService
{
    public const int Limit = 100;

    public async Task<List<Notification>> GetAsync(Guid companyId, CancellationToken cancellationToken)
    {
        // Имя — только пользователя той же компании (u.company_id в условии соединения)
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "SELECT n.id, n.type::text, n.occurred_at, n.user_id, u.full_name, n.flags::text, n.read_at IS NOT NULL " +
            "FROM notifications n LEFT JOIN users u ON u.id = n.user_id AND u.company_id = n.company_id " +
            "WHERE n.company_id = @companyId " +
            "ORDER BY n.occurred_at DESC, n.id DESC LIMIT @limit",
            conn);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("limit", Limit);

        var notifications = new List<Notification>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            notifications.Add(new Notification
            {
                Id = reader.GetInt64(0),
                Type = Enum.Parse<NotificationType>(reader.GetString(1)),
                OccurredAt = reader.GetInt64(2),
                UserId = reader.GetGuid(3),
                UserName = reader.IsDBNull(4) ? null : reader.GetString(4),
                Flags = reader.IsDBNull(5) ? null : JsonSerializer.Deserialize<Dictionary<string, int>>(reader.GetString(5)),
                IsRead = reader.GetBoolean(6),
            });
        }

        return notifications;
    }

    public async Task<bool> MarkReadAsync(Guid companyId, long id, CancellationToken cancellationToken)
    {
        // COALESCE: повторная отметка не сдвигает момент прочтения
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "UPDATE notifications SET read_at = COALESCE(read_at, @now) WHERE id = @id AND company_id = @companyId",
            conn);
        cmd.Parameters.AddWithValue("now", timeProvider.GetUtcNow().ToUnixTimeSeconds());
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);
        return await cmd.ExecuteNonQueryAsync(cancellationToken) == 1;
    }
}
