using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.OfflineRentalPayload
// Содержимое QR-кода сотрудника: исходный ServerSignedToken, дополненный фронтендом сотрудника
// полями Action/ToolCondition/ToolId/ToolName/Timestamp и подписанный целиком WorkerSignature.
public class OfflineRentalPayload
{
    [Required]
    public ServerSignedToken ServerSignedToken { get; set; } = new();

    [Required]
    public RentalAction Action { get; set; }

    [Required]
    public ToolCondition ToolCondition { get; set; }

    public int ToolId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    // Unix time создания QR-кода
    public int Timestamp { get; set; }

    [Required]
    public string WorkerSignature { get; set; } = string.Empty;
}

// components.schemas.RentalLogEntry
// ToolId/WorkerId nullable: если ID из payload не резолвится в реальную запись
// (например, при поддельной подписи), приходит null — недоверие видно по ValidationFlag.
public class RentalLogEntry
{
    public int Id { get; set; }

    public int? ToolId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    public int? WorkerId { get; set; }

    public string WorkerName { get; set; } = string.Empty;

    public int IssuerId { get; set; }

    public RentalAction Action { get; set; }

    public ToolCondition ToolCondition { get; set; }

    public int QrTimestamp { get; set; }

    public ValidationFlag ValidationFlag { get; set; }

    public DateTime CreatedAt { get; set; }
}