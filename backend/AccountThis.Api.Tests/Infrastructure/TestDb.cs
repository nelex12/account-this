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
// и чтобы проверить, что именно записалось в БД. Работает со схемой database/init.sql.
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

    public async Task SetUserFlagsAsync(Guid userId, bool isApproved, bool isActive)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE users SET is_approved = @approved, is_active = @active WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("approved", isApproved);
        cmd.Parameters.AddWithValue("active", isActive);
        cmd.Parameters.AddWithValue("id", userId);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        return conn;
    }
}
