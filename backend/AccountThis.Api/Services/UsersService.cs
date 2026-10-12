using AccountThis.Api.Models;
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
    // Все пользователи компании, включая неподтверждённых и уволенных
    Task<List<UserResponse>> GetUsersAsync(Guid companyId, CancellationToken cancellationToken);

    // currentUserId — id вызывающего Owner (из JWT), чтобы запретить увольнение самого себя
    Task<DeactivateUserStatus> DeactivateAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken);

    // false — пользователь не найден в компании; повторное подтверждение — true
    Task<bool> ApproveAsync(Guid companyId, Guid id, CancellationToken cancellationToken);
}

public class UsersService(NpgsqlDataSource dataSource) : IUsersService
{
    public async Task<List<UserResponse>> GetUsersAsync(Guid companyId, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "SELECT id, full_name, phone, role::text, is_approved, is_active " +
            "FROM users WHERE company_id = @companyId " +
            "ORDER BY created_at, id",
            conn);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var users = new List<UserResponse>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            users.Add(new UserResponse
            {
                Id = reader.GetGuid(0),
                FullName = reader.GetString(1),
                Phone = reader.GetString(2),
                Role = Enum.Parse<UserRole>(reader.GetString(3)),
                IsApproved = reader.GetBoolean(4),
                IsActive = reader.GetBoolean(5),
            });
        }

        return users;
    }

    public Task<DeactivateUserStatus> DeactivateAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken)
    {
        // В одной транзакции:
        // 1. is_active = false, deactivated_at = время сервера — только если пользователь ещё не уволен
        //    (повторное увольнение момент не меняет). Пользователь другой компании — NotFound.
        // 2. Погасить все действующие refresh token пользователя: revoked_at = время сервера WHERE revoked_at IS NULL.
        throw new NotImplementedException();
    }

    public async Task<bool> ApproveAsync(Guid companyId, Guid id, CancellationToken cancellationToken)
    {
        // company_id в WHERE — защита от BOLA: пользователь чужой компании не найдётся (0 строк — 404)
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "UPDATE users SET is_approved = TRUE WHERE id = @id AND company_id = @companyId",
            conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);

        return await cmd.ExecuteNonQueryAsync(cancellationToken) == 1;
    }
}
