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
    public async Task<Company?> GetCompanyAsync(Guid companyId, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand("SELECT id, name FROM companies WHERE id = @companyId", conn);
        cmd.Parameters.AddWithValue("companyId", companyId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new Company { Id = reader.GetGuid(0), Name = reader.GetString(1) };
    }
}
