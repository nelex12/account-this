using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

public class SyncRecord
{
    [Required]
    public string? Qr { get; set; }

    [Required]
    public long? ScannedAt { get; set; }
}

// components.schemas.SyncResult
public class SyncResult
{
    // Для повторно отправленной записи — id уже существующей
    public int LogId { get; set; }

    public ValidationFlag ValidationFlag { get; set; }
}

public class RentalOperation
{
    public RentalAction Action { get; set; }

    public ToolCondition ToolCondition { get; set; }

    // UUID инструмента в каноническом виде (строчные hex, 8-4-4-4-12)
    public Guid ToolId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    // Unix time создания QR-кода
    public long Timestamp { get; set; }
}

public class RentalLogEntry
{
    public int Id { get; set; }

    public Guid? ToolId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    public Guid? WorkerId { get; set; }

    public string WorkerName { get; set; } = string.Empty;

    public Guid IssuerId { get; set; }

    public RentalAction Action { get; set; }

    public ToolCondition ToolCondition { get; set; }

    // Время операции (timestamp из op)
    public long QrTimestamp { get; set; }

    // Время сканирования завхозом
    public long ScannedAt { get; set; }

    public ValidationFlag ValidationFlag { get; set; }

    // Unix time сохранения на сервере (синхронизации)
    public long CreatedAt { get; set; }
}
