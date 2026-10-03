using AccountThis.Api.Models;
using Npgsql;

namespace AccountThis.Api.Services;

// Чтение инструментов — из view tools_with_holders (Tool вместе с текущим держателем)
public interface IToolsService
{
    // Только активные (не списанные)
    Task<List<Tool>> GetActiveToolsAsync(CancellationToken cancellationToken);

    // Состояние Good, без комментария и держателя
    Task<Tool> CreateAsync(CreateToolRequest request, CancellationToken cancellationToken);

    // В том числе списанный; null — не найден
    Task<Tool?> GetByIdAsync(int id, CancellationToken cancellationToken);

    // false — не найден
    Task<bool> UpdateConditionAsync(int id, UpdateToolConditionRequest request, CancellationToken cancellationToken);

    // Списание (is_active = false); false — не найден, повторное списание — true
    Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken);
}

public class ToolsService(NpgsqlDataSource dataSource, TimeProvider timeProvider) : IToolsService
{
    public Task<List<Tool>> GetActiveToolsAsync(CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<Tool> CreateAsync(CreateToolRequest request, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<Tool?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateConditionAsync(int id, UpdateToolConditionRequest request, CancellationToken cancellationToken)
    {
        // Condition != null — меняет condition и condition_updated_at = время сервера.
        // Comment != null — меняет comment ("" — очистить, записывается NULL).
        throw new NotImplementedException();
    }

    public Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
