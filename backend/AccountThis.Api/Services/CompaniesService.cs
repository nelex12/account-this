using AccountThis.Api.Models;
using Npgsql;

namespace AccountThis.Api.Services;

public interface ICompaniesService
{
    // Компания вызывающего (companyId из JWT) — Owner берёт из неё id, чтобы сообщить его сотрудникам и завхозам.
    // null — компании нет (не должно случаться: компании не удаляются)
    Task<Company?> GetCompanyAsync(Guid companyId, CancellationToken cancellationToken);
}

// Компании создаются только при регистрации Owner (AuthService.RegisterAsync), отдельного создания нет.
// Списка всех компаний нет: чужую компанию не узнать ни по названию, ни перебором id.
public class CompaniesService(NpgsqlDataSource dataSource) : ICompaniesService
{
    public Task<Company?> GetCompanyAsync(Guid companyId, CancellationToken cancellationToken)
    {
        // SELECT id, name FROM companies WHERE id = @companyId
        throw new NotImplementedException();
    }
}
