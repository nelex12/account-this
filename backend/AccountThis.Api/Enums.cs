using System.Text.Json.Serialization;

namespace AccountThis.Api.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum UserRole
    {
        Worker,
        Issuer,
        Owner
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ToolCondition
    {
        Good,
        Damaged,
        Broken
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RentalAction
    {
        TAKE,
        GIVE
    }

    // Проверки выполняются в порядке объявления (после VALID), флаг — по первой непройденной.
    // Строка QR не по формату AT1 флага не получает: запрос /api/sync отклоняется целиком (400).
    // UNKNOWN_WORKER и UNKNOWN_TOOL — сотрудника или инструмента нет в компании завхоза
    // (из другой компании неотличимо от несуществующего).
    // WORKER_DEACTIVATED — сотрудник уволен, и timestamp >= users.deactivated_at (офлайн-сертификат не отзывается).
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ValidationFlag
    {
        VALID,
        INVALID_SERVER_SIG,
        INVALID_WORKER_SIG,
        EXPIRED_TOKEN,
        TIME_DRIFT,
        UNKNOWN_WORKER,
        WORKER_DEACTIVATED,
        UNKNOWN_TOOL,
        DUPLICATE
    }

    // Совпадает с notification_type в БД (Migrations/0002_outbox_notifications.sql)
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum NotificationType
    {
        EmployeeAwaitingApproval,
        SessionReuseDetected,
        SuspiciousSync
    }
}