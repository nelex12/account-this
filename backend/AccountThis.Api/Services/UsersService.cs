using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Npgsql;

namespace AccountThis.Api.Services;

public enum DeactivateUserStatus
{
    // В том числе повторный вызов для уже уволенного
    Deactivated,
    NotFound,
    SelfDeactivation
}

public interface IUsersService
{
    // Все пользователи, включая неподтверждённых и уволенных
    Task<List<UserResponse>> GetUsersAsync(CancellationToken cancellationToken);

    // currentUserId — id вызывающего Owner (из JWT), чтобы запретить увольнение самого себя
    Task<DeactivateUserStatus> DeactivateAsync(int currentUserId, int id, CancellationToken cancellationToken);

    // false — пользователь не найден; повторное подтверждение — true
    Task<bool> ApproveAsync(int id, CancellationToken cancellationToken);

    // Первый Owner из OWNER_PHONE / OWNER_PASSWORD / OWNER_FULLNAME (сразу is_approved = true),
    // если в users нет ни одного Owner. Вызывается один раз при старте из Program.cs (подключить после реализации).
    Task EnsureInitialOwnerAsync(CancellationToken cancellationToken);
}

public class UsersService(
    NpgsqlDataSource dataSource,
    IPasswordHasher passwordHasher,
    IConfiguration configuration) : IUsersService
{
    public Task EnsureInitialOwnerAsync(CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<List<UserResponse>> GetUsersAsync(CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<DeactivateUserStatus> DeactivateAsync(int currentUserId, int id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<bool> ApproveAsync(int id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
