using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.CreateToolRequest
public class CreateToolRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;
}

// components.schemas.UpdateToolConditionRequest
public class UpdateToolConditionRequest
{
    public ToolCondition? Condition { get; set; }

    public string? Comment { get; set; }
}

// components.schemas.Tool
public class Tool
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public ToolCondition Condition { get; set; }

    public string? Comment { get; set; }

    public bool IsActive { get; set; }
}