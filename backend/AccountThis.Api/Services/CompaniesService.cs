using AccountThis.Api.Models;
using Npgsql;

namespace AccountThis.Api.Services;

public interface ICompaniesService
{
    Task<Company?> GetCompanyAsync(Guid companyId, CancellationToken cancellationToken);
}

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
