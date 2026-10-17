using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace AccountThis.Api.Tests.Infrastructure;

public sealed record UserRow(
    Guid Id,
    Guid CompanyId,
    string FullName,
    string Phone,
    string PasswordHash,
    string Role,
    bool IsApproved,
    bool IsActive);

// SQL в обход API. Нужен там, где API для этого ещё нет (подтверждение и увольнение — блок 4)
// или его не видно снаружи (refresh token хранится хешем, его срок — 30 дней)
// и чтобы проверить, что именно записалось в БД. Работает со схемой из миграций (AccountThis.Api/Migrations).
public sealed class TestDb(string connectionString)
{
    // БД одна на весь прогон, поэтому каждому тесту — свой телефон
    private static int _phoneCounter = Random.Shared.Next(0, 100_000_000);

    // Сразу в нормализованном виде +7XXXXXXXXXX
    public static string UniquePhone() => "+79" + Interlocked.Increment(ref _phoneCounter).ToString("D9");

    public async Task<Guid> CreateCompanyAsync(string name = "Тестовая компания")
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("INSERT INTO companies (name) VALUES (@name) RETURNING id", conn);
        cmd.Parameters.AddWithValue("name", name);
        return (Guid)(await cmd.ExecuteScalarAsync())!;
    }

    public async Task<string?> FindCompanyNameAsync(Guid companyId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT name FROM companies WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", companyId);
        return (string?)await cmd.ExecuteScalarAsync();
    }

    public async Task<long> CountCompaniesAsync(string name)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM companies WHERE name = @name", conn);
        cmd.Parameters.AddWithValue("name", name);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    // phone — нормализованный (+7XXXXXXXXXX)
    public async Task<UserRow?> FindUserAsync(string phone)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            """
            SELECT id, company_id, full_name, phone, password_hash, role::text, is_approved, is_active
            FROM users WHERE phone = @phone
            """, conn);
        cmd.Parameters.AddWithValue("phone", phone);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return new UserRow(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetBoolean(6),
            reader.GetBoolean(7));
    }

    // Увольнение в обход API выставляет и момент увольнения (CHECK в users), но refresh token не гасит
    public async Task SetUserFlagsAsync(Guid userId, bool isApproved, bool isActive)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE users SET is_approved = @approved, is_active = @active,
                deactivated_at = CASE WHEN @active THEN NULL ELSE floor(extract(epoch FROM now()))::BIGINT END
            WHERE id = @id
            """, conn);
        cmd.Parameters.AddWithValue("approved", isApproved);
        cmd.Parameters.AddWithValue("active", isActive);
        cmd.Parameters.AddWithValue("id", userId);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<long?> FindDeactivatedAtAsync(Guid userId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT deactivated_at FROM users WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", userId);
        var value = await cmd.ExecuteScalarAsync();
        return value is DBNull or null ? null : (long)value;
    }

    // Сдвигает момент увольнения в прошлое: так видно, перезаписал ли его повторный вызов
    public async Task ShiftDeactivatedAtAsync(Guid userId, TimeSpan back)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE users SET deactivated_at = deactivated_at - @shift WHERE id = @id AND deactivated_at IS NOT NULL", conn);
        cmd.Parameters.AddWithValue("shift", (long)back.TotalSeconds);
        cmd.Parameters.AddWithValue("id", userId);
        var updated = await cmd.ExecuteNonQueryAsync();
        Assert.True(updated == 1, "Подготовка теста: пользователь не уволен");
    }

    // ---------- refresh_tokens ----------

    // Сервер хранит SHA-256 токена; токен в cookie — base64url без паддинга
    public static byte[] RefreshTokenHash(string refreshToken) =>
        SHA256.HashData(Base64UrlEncoder.DecodeBytes(refreshToken));

    public async Task<long> CountActiveRefreshTokensAsync(Guid userId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT count(*) FROM refresh_tokens WHERE user_id = @id AND revoked_at IS NULL", conn);
        cmd.Parameters.AddWithValue("id", userId);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    public async Task<bool> RefreshTokenExistsAsync(byte[] tokenHash)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM refresh_tokens WHERE token_hash = @hash)", conn);
        cmd.Parameters.AddWithValue("hash", tokenHash);
        return (bool)(await cmd.ExecuteScalarAsync())!;
    }

    // Истечение срока без ожидания 30 дней: сдвигает срок токена в прошлое
    public async Task ExpireRefreshTokenAsync(string refreshToken)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE refresh_tokens SET created_at = created_at - @shift, expires_at = expires_at - @shift WHERE token_hash = @hash",
            conn);
        cmd.Parameters.AddWithValue("shift", (long)TimeSpan.FromDays(31).TotalSeconds);
        cmd.Parameters.AddWithValue("hash", RefreshTokenHash(refreshToken));
        var updated = await cmd.ExecuteNonQueryAsync();
        Assert.True(updated == 1, "Подготовка теста: refresh token не найден в refresh_tokens по SHA-256");
    }

    // ---------- tools ----------

    public async Task<(string Condition, long ConditionUpdatedAt)> FindToolConditionAsync(Guid toolId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT condition::text, condition_updated_at FROM tools WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", toolId);
        await using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync(), "Инструмент не найден в tools");
        return (reader.GetString(0), reader.GetInt64(1));
    }

    // Состояние инструмента выставлено «давно»: операции из /api/sync с недавним timestamp его обновляют
    public async Task BackdateToolConditionAsync(Guid toolId, TimeSpan back)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE tools SET condition_updated_at = condition_updated_at - @shift WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("shift", (long)back.TotalSeconds);
        cmd.Parameters.AddWithValue("id", toolId);
        Assert.True(await cmd.ExecuteNonQueryAsync() == 1, "Подготовка теста: инструмент не найден");
    }

    // ---------- rental_logs ----------

    public async Task<long> CountRentalLogsAsync(Guid companyId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM rental_logs WHERE company_id = @id", conn);
        cmd.Parameters.AddWithValue("id", companyId);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    // ---------- audit_events ----------

    public sealed record AuditRow(Guid EventId, string Type, Guid CompanyId, Guid ActorId, long OccurredAt, JsonElement Data);

    public async Task<List<AuditRow>> FindAuditEventsAsync(Guid companyId, string type)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT event_id, type, company_id, actor_id, occurred_at, data::text FROM audit_events " +
            "WHERE company_id = @companyId AND type = @type ORDER BY id",
            conn);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("type", type);

        var rows = new List<AuditRow>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            using var data = JsonDocument.Parse(reader.GetString(5));
            rows.Add(new AuditRow(reader.GetGuid(0), reader.GetString(1), reader.GetGuid(2), reader.GetGuid(3),
                reader.GetInt64(4), data.RootElement.Clone()));
        }

        return rows;
    }

    // Запись в audit_events асинхронная (RabbitMQ → потребитель), поэтому ждём с таймаутом
    public async Task<List<AuditRow>> WaitForAuditEventsAsync(Guid companyId, string type, int count = 1, int timeoutSeconds = 15)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
        while (true)
        {
            var rows = await FindAuditEventsAsync(companyId, type);
            if (rows.Count >= count || DateTime.UtcNow > deadline)
            {
                Assert.True(rows.Count >= count,
                    $"За {timeoutSeconds} с в audit_events появилось {rows.Count} событий {type}, ожидалось {count}");
                return rows;
            }

            await Task.Delay(100);
        }
    }

    public async Task<long> CountAuditEventsAsync(Guid eventId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM audit_events WHERE event_id = @id", conn);
        cmd.Parameters.AddWithValue("id", eventId);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    // ---------- outbox_events ----------

    // Событие в outbox в обход сервисов и без NOTIFY: как оставшееся после сбоя
    public async Task InsertOutboxEventAsync(Guid eventId, string type, Guid companyId, Guid actorId, string data)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO outbox_events (event_id, type, company_id, actor_id, occurred_at, data) " +
            "VALUES (@eventId, @type, @companyId, @actorId, 1790000000, @data::jsonb)",
            conn);
        cmd.Parameters.AddWithValue("eventId", eventId);
        cmd.Parameters.AddWithValue("type", type);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("actorId", actorId);
        cmd.Parameters.AddWithValue("data", data);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<long> CountOutboxEventsAsync(Guid eventId)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM outbox_events WHERE event_id = @id", conn);
        cmd.Parameters.AddWithValue("id", eventId);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        return conn;
    }
}
