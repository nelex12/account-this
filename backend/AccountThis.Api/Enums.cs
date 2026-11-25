using System.Text.Json.Serialization;

namespace AccountThis.Api.Models
{
    [JsonConverter(typeof(StrictEnumConverter<UserRole>))]
    public enum UserRole
    {
        Worker,
        Issuer,
        Owner
    }

    [JsonConverter(typeof(StrictEnumConverter<ToolCondition>))]
    public enum ToolCondition
    {
        Good,
        Damaged,
        Broken
    }

    [JsonConverter(typeof(StrictEnumConverter<RentalAction>))]
    public enum RentalAction
    {
        TAKE,
        GIVE
    }

    // Первый сбой определяет флаг.
    [JsonConverter(typeof(StrictEnumConverter<ValidationFlag>))]
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

    [JsonConverter(typeof(StrictEnumConverter<NotificationType>))]
    public enum NotificationType
    {
        EmployeeAwaitingApproval,
        SessionReuseDetected,
        SuspiciousSync
    }
}