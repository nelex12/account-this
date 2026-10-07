using AccountThis.Api.Models;
using Npgsql;

namespace AccountThis.Api.Services;

// Чтение инструментов — из view tools_with_holders (Tool вместе с текущим держателем).
// Все методы ограничены компанией вызывающего (companyId из JWT): инструмент другой компании
// неотличим от несуществующего (null / false).
public interface IToolsService
{
    // Только активные (не списанные)
    Task<List<Tool>> GetActiveToolsAsync(Guid companyId, CancellationToken cancellationToken);

    // Инструмент создаётся в компании companyId; состояние Good, без комментария и держателя
    Task<Tool> CreateAsync(Guid companyId, CreateToolRequest request, CancellationToken cancellationToken);

    // В том числе списанный; null — не найден
    Task<Tool?> GetByIdAsync(Guid companyId, Guid id, CancellationToken cancellationToken);

    // false — не найден
    Task<bool> UpdateConditionAsync(Guid companyId, Guid id, UpdateToolConditionRequest request, CancellationToken cancellationToken);

    // Списание (is_active = false); false — не найден, повторное списание — true
    Task<bool> DeactivateAsync(Guid companyId, Guid id, CancellationToken cancellationToken);
}

public class ToolsService(NpgsqlDataSource dataSource, TimeProvider timeProvider) : IToolsService
{
    public Task<List<Tool>> GetActiveToolsAsync(Guid companyId, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<Tool> CreateAsync(Guid companyId, CreateToolRequest request, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<Tool?> GetByIdAsync(Guid companyId, Guid id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateConditionAsync(Guid companyId, Guid id, UpdateToolConditionRequest request, CancellationToken cancellationToken)
    {
        // Condition != null — меняет condition и condition_updated_at = время сервера.
        // Comment != null — меняет comment ("" — очистить, записывается NULL).
        throw new NotImplementedException();
    }

    public Task<bool> DeactivateAsync(Guid companyId, Guid id, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
