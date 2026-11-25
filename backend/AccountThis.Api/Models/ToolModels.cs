using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.CreateToolRequest
public class CreateToolRequest
{
    [Required]
    [MaxLength(100)]
    [NoNullCharacter]
    public string Name { get; set; } = string.Empty;
}

public class UpdateToolConditionRequest
{
    public ToolCondition? Condition { get; set; }

    [NoNullCharacter]
    public string? Comment { get; set; }
}

public class Tool
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public ToolCondition Condition { get; set; }

    public string? Comment { get; set; }

    public bool IsActive { get; set; }

    public Guid? HolderId { get; set; }

    // ФИО сотрудника-держателя (из users)
    public string? HolderName { get; set; }

    // Unix time операции TAKE, с которой инструмент у держателя
    public long? HeldSince { get; set; }
}