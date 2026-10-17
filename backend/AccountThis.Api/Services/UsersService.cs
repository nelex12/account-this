using AccountThis.Api.Events;
using AccountThis.Api.Models;
using AccountThis.Shared.Events;
using Npgsql;

namespace AccountThis.Api.Services;

public enum DeactivateUserStatus
{
    // В том числе повторный вызов для уже уволенного
    Deactivated,

    // Нет такого пользователя в компании вызывающего (пользователь другой компании — тоже NotFound)
    NotFound,
    SelfDeactivation
}

// Owner работает только с пользователями своей компании: companyId — из JWT вызывающего Owner.
// Пользователь другой компании неотличим от несуществующего.
public interface IUsersService
{
    // Пользователь из JWT вызывающего (любая роль); null — его нет в этой компании
    Task<UserResponse?> GetMeAsync(Guid companyId, Guid userId, CancellationToken cancellationToken);

    // Все пользователи компании, включая неподтверждённых и уволенных
    Task<List<UserResponse>> GetUsersAsync(Guid companyId, CancellationToken cancellationToken);

    // currentUserId — id вызывающего Owner (из JWT), чтобы запретить увольнение самого себя
    Task<DeactivateUserStatus> DeactivateAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken);

    // false — пользователь не найден в компании; повторное подтверждение — true.
    // currentUserId — id вызывающего Owner (из JWT), автор события user.approved
    Task<bool> ApproveAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken);
}

public class UsersService(NpgsqlDataSource dataSource, IEventOutbox eventOutbox, TimeProvider timeProvider) : IUsersService
{
    private const string UserColumns = "id, full_name, phone, role::text, is_approved, is_active";

    public async Task<UserResponse?> GetMeAsync(Guid companyId, Guid userId, CancellationToken cancellationToken)
    {
        // company_id в WHERE — та же изоляция, что и везде: id из токена ищется только в компании из токена
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            $"SELECT {UserColumns} FROM users WHERE id = @id AND company_id = @companyId",
            conn);
        cmd.Parameters.AddWithValue("id", userId);
        cmd.Parameters.AddWithValue("companyId", companyId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadUser(reader) : null;
    }

    public async Task<List<UserResponse>> GetUsersAsync(Guid companyId, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            $"SELECT {UserColumns} FROM users WHERE company_id = @companyId " +
            "ORDER BY created_at, id",
            conn);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var users = new List<UserResponse>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            users.Add(ReadUser(reader));
        }

        return users;
    }

    public async Task<DeactivateUserStatus> DeactivateAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken)
    {
        if (id == currentUserId)
        {
            return DeactivateUserStatus.SelfDeactivation;
        }

        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

        // FOR UPDATE: параллельные увольнения одного пользователя идут по очереди, событие — одно.
        // company_id в WHERE — пользователь чужой компании не найдётся (NotFound)
        bool wasActive;
        await using (var cmdFind = new NpgsqlCommand(
            "SELECT is_active FROM users WHERE id = @id AND company_id = @companyId FOR UPDATE",
            conn,
            transaction))
        {
            cmdFind.Parameters.AddWithValue("id", id);
            cmdFind.Parameters.AddWithValue("companyId", companyId);
            var result = await cmdFind.ExecuteScalarAsync(cancellationToken);
            if (result is null)
            {
                return DeactivateUserStatus.NotFound;
            }

            wasActive = (bool)result;
        }

        // Повторное увольнение момент увольнения не меняет: по нему /api/sync выставляет WORKER_DEACTIVATED
        if (wasActive)
        {
            await using var cmdDeactivate = new NpgsqlCommand(
                "UPDATE users SET is_active = FALSE, deactivated_at = @now WHERE id = @id",
                conn,
                transaction);
            cmdDeactivate.Parameters.AddWithValue("now", now);
            cmdDeactivate.Parameters.AddWithValue("id", id);
            await cmdDeactivate.ExecuteNonQueryAsync(cancellationToken);
        }

        // Гасятся все действующие refresh token — все сессии пользователя. Сессия = family_id
        int revokedSessions;
        await using (var cmdRevoke = new NpgsqlCommand(
            "WITH revoked AS (" +
            "  UPDATE refresh_tokens SET revoked_at = @now WHERE user_id = @id AND revoked_at IS NULL RETURNING family_id" +
            ") SELECT count(DISTINCT family_id)::int FROM revoked",
            conn,
            transaction))
        {
            cmdRevoke.Parameters.AddWithValue("now", now);
            cmdRevoke.Parameters.AddWithValue("id", id);
            revokedSessions = (int)(await cmdRevoke.ExecuteScalarAsync(cancellationToken))!;
        }

        if (wasActive)
        {
            await eventOutbox.AddAsync(conn, transaction, EventTypes.UserDeactivated, companyId, currentUserId,
                new { userId = id, revokedSessions }, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return DeactivateUserStatus.Deactivated;
    }

    public async Task<bool> ApproveAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken)
    {
        // company_id в WHERE — защита от BOLA: пользователь чужой компании не найдётся (0 строк — 404).
        // prev — значение до изменения (строка заблокирована FOR UPDATE): событие только если подтверждения ещё не было
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "WITH prev AS (SELECT is_approved FROM users WHERE id = @id AND company_id = @companyId FOR UPDATE) " +
            "UPDATE users u SET is_approved = TRUE FROM prev WHERE u.id = @id " +
            "RETURNING prev.is_approved",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        if (result is null)
        {
            return false;
        }

        if (!(bool)result)
        {
            await eventOutbox.AddAsync(conn, transaction, EventTypes.UserApproved, companyId, currentUserId, new { userId = id }, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    // Колонки — в порядке UserColumns
    private static UserResponse ReadUser(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetGuid(0),
        FullName = reader.GetString(1),
        Phone = reader.GetString(2),
        Role = Enum.Parse<UserRole>(reader.GetString(3)),
        IsApproved = reader.GetBoolean(4),
        IsActive = reader.GetBoolean(5),
    };
}
