using AccountThis.Api.Events;
using AccountThis.Api.Models;
using AccountThis.Shared.Events;
using Npgsql;

namespace AccountThis.Api.Services;

// Чтение инструментов — из view tools_with_holders (Tool вместе с текущим держателем).
// Все методы ограничены компанией вызывающего (companyId из JWT): инструмент другой компании
// неотличим от несуществующего (null / false). actorId — id вызывающего (из JWT), автор события аудита.
public interface IToolsService
{
    // Только активные (не списанные)
    Task<List<Tool>> GetActiveToolsAsync(Guid companyId, CancellationToken cancellationToken);

    // Инструмент создаётся в компании companyId; состояние Good, без комментария и держателя
    Task<Tool> CreateAsync(Guid companyId, Guid actorId, CreateToolRequest request, CancellationToken cancellationToken);

    // В том числе списанный; null — не найден
    Task<Tool?> GetByIdAsync(Guid companyId, Guid id, CancellationToken cancellationToken);

    // false — не найден
    Task<bool> UpdateConditionAsync(Guid companyId, Guid actorId, Guid id, UpdateToolConditionRequest request, CancellationToken cancellationToken);

    // Списание (is_active = false); false — не найден, повторное списание — true
    Task<bool> DeactivateAsync(Guid companyId, Guid actorId, Guid id, CancellationToken cancellationToken);
}

public class ToolsService(NpgsqlDataSource dataSource, IEventOutbox eventOutbox, TimeProvider timeProvider) : IToolsService
{
    private const string ToolColumns = "id, name, condition::text, comment, is_active, holder_id, holder_name, held_since";

    public async Task<List<Tool>> GetActiveToolsAsync(Guid companyId, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            $"SELECT {ToolColumns} FROM tools_with_holders WHERE company_id = @companyId AND is_active ORDER BY name, id",
            conn);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var tools = new List<Tool>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            tools.Add(ReadTool(reader));
        }

        return tools;
    }

    public async Task<Tool> CreateAsync(Guid companyId, Guid actorId, CreateToolRequest request, CancellationToken cancellationToken)
    {
        // Состояние, время изменения состояния и is_active — значения по умолчанию из схемы; держателя у нового нет
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO tools (company_id, name) VALUES (@companyId, @name) " +
            "RETURNING id, name, condition::text, comment, is_active",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("name", request.Name);

        Tool tool;
        await using (var reader = await cmd.ExecuteReaderAsync(cancellationToken))
        {
            await reader.ReadAsync(cancellationToken);
            tool = new Tool
            {
                Id = reader.GetGuid(0),
                Name = reader.GetString(1),
                Condition = Enum.Parse<ToolCondition>(reader.GetString(2)),
                Comment = reader.IsDBNull(3) ? null : reader.GetString(3),
                IsActive = reader.GetBoolean(4),
            };
        }

        await eventOutbox.AddAsync(conn, transaction, EventTypes.ToolCreated, companyId, actorId,
            new { toolId = tool.Id, name = tool.Name }, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return tool;
    }

    public async Task<Tool?> GetByIdAsync(Guid companyId, Guid id, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            $"SELECT {ToolColumns} FROM tools_with_holders WHERE id = @id AND company_id = @companyId",
            conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadTool(reader) : null;
    }

    public async Task<bool> UpdateConditionAsync(Guid companyId, Guid actorId, Guid id, UpdateToolConditionRequest request, CancellationToken cancellationToken)
    {
        // Condition != null — меняет condition и condition_updated_at = время сервера.
        // Comment != null — меняет comment ("" — очистить, записывается NULL).
        // Не передано ничего — только проверка, что инструмент есть (200 / 404)
        var assignments = new List<string>();
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand { Connection = conn, Transaction = transaction };

        if (request.Condition is not null)
        {
            assignments.Add("condition = @condition::tool_condition, condition_updated_at = @now");
            cmd.Parameters.AddWithValue("condition", request.Condition.Value.ToString());
            cmd.Parameters.AddWithValue("now", timeProvider.GetUtcNow().ToUnixTimeSeconds());
        }

        if (request.Comment is not null)
        {
            assignments.Add("comment = @comment");
            cmd.Parameters.AddWithValue("comment", request.Comment.Length == 0 ? DBNull.Value : (object)request.Comment);
        }

        // Имена столбцов — константы выше, значения — только через параметры
        cmd.CommandText = assignments.Count == 0
            ? "SELECT 1 FROM tools WHERE id = @id AND company_id = @companyId"
            : $"UPDATE tools SET {string.Join(", ", assignments)} WHERE id = @id AND company_id = @companyId RETURNING 1";
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var found = await cmd.ExecuteScalarAsync(cancellationToken) is not null;
        if (found && assignments.Count > 0)
        {
            var data = new Dictionary<string, object?> { ["toolId"] = id };
            if (request.Condition is not null)
            {
                data["condition"] = request.Condition.Value.ToString();
            }

            if (request.Comment is not null)
            {
                data["comment"] = request.Comment;
            }

            await eventOutbox.AddAsync(conn, transaction, EventTypes.ToolUpdated, companyId, actorId, data, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return found;
    }

    public async Task<bool> DeactivateAsync(Guid companyId, Guid actorId, Guid id, CancellationToken cancellationToken)
    {
        // prev — значение до изменения (строка заблокирована): событие только при первом списании
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "WITH prev AS (SELECT is_active FROM tools WHERE id = @id AND company_id = @companyId FOR UPDATE) " +
            "UPDATE tools t SET is_active = FALSE FROM prev WHERE t.id = @id " +
            "RETURNING prev.is_active",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("companyId", companyId);

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        if (result is null)
        {
            return false;
        }

        if ((bool)result)
        {
            await eventOutbox.AddAsync(conn, transaction, EventTypes.ToolWrittenOff, companyId, actorId, new { toolId = id }, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    // Колонки — в порядке ToolColumns
    private static Tool ReadTool(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetGuid(0),
        Name = reader.GetString(1),
        Condition = Enum.Parse<ToolCondition>(reader.GetString(2)),
        Comment = reader.IsDBNull(3) ? null : reader.GetString(3),
        IsActive = reader.GetBoolean(4),
        HolderId = reader.IsDBNull(5) ? null : reader.GetGuid(5),
        HolderName = reader.IsDBNull(6) ? null : reader.GetString(6),
        HeldSince = reader.IsDBNull(7) ? null : reader.GetInt64(7),
    };
}
