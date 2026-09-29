using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.SyncRecord
// Запись локального журнала завхоза. Строку QR (components.schemas.OfflineRentalPayload,
// формат "AT1.<token>.<serverSignature>.<op>.<workerSignature>") сервер разбирает сам, строго по правилам
// формата из описания. Строка не по формату — ошибка конверта: весь запрос отклоняется (400)
// с перечислением номеров таких записей, ничего не сохраняется.
public class SyncRecord
{
    [Required]
    public string? Qr { get; set; }

    // Unix time сканирования по часам завхоза (с поправкой на смещение относительно сервера)
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

// components.schemas.RentalOperation
// Содержимое op из строки QR (base64url → UTF-8 JSON) — операция, заявленная и подписанная сотрудником.
// Разбирается строго (см. описание, «Формат QR и подписей»): десериализация System.Text.Json по умолчанию
// для этого не подходит — она молча подставляет значения по умолчанию, принимает числа-строки и enum в любом регистре.
public class RentalOperation
{
    public RentalAction Action { get; set; }

    public ToolCondition ToolCondition { get; set; }

    public int ToolId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    // Unix time создания QR-кода
    public long Timestamp { get; set; }
}

// components.schemas.RentalLogEntry
// Привязка определяется флагом: WorkerId — null при INVALID_SERVER_SIG;
// ToolId — null при INVALID_SERVER_SIG, INVALID_WORKER_SIG, UNKNOWN_TOOL.
// WorkerName/ToolName — из users/tools, если Id заполнен, иначе из непроверенных значений внутри строки QR.
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

    // Время операции (timestamp из op)
    public long QrTimestamp { get; set; }

    // Время сканирования завхозом
    public long ScannedAt { get; set; }

    public ValidationFlag ValidationFlag { get; set; }

    // Unix time сохранения на сервере (синхронизации)
    public long CreatedAt { get; set; }
}
