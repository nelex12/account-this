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
    public Task<List<UserResponse>> GetUsersAsync(Guid companyId, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<DeactivateUserStatus> DeactivateAsync(Guid companyId, Guid currentUserId, Guid id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<bool> ApproveAsync(Guid companyId, Guid id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
