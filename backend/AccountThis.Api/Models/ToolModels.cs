using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.CreateToolRequest
public class CreateToolRequest
{
    // Не длиннее 100 символов: название попадает в QR сотрудника (toolName в op)
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}

// components.schemas.UpdateToolConditionRequest
// Не переданное (null) поле не меняется; Comment = "" очищает комментарий.
// Разрешено и для списанного инструмента (is_active не меняется).
public class UpdateToolConditionRequest
{
    public ToolCondition? Condition { get; set; }

    public string? Comment { get; set; }
}

// components.schemas.Tool
// Holder* вычисляются по view tool_current_holders (последняя VALID-операция по qr_timestamp):
// TAKE — инструмент на руках у сотрудника; GIVE или нет записей — на месте у завхоза, все три поля null.
public class Tool
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public ToolCondition Condition { get; set; }

    public string? Comment { get; set; }

    public bool IsActive { get; set; }

    // id сотрудника, у которого инструмент на руках; null — на месте у завхоза
    public int? HolderId { get; set; }

    // ФИО сотрудника-держателя (из users)
    public string? HolderName { get; set; }

    // Unix time операции TAKE, с которой инструмент у держателя
    public long? HeldSince { get; set; }
}