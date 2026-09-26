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

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ValidationFlag
    {
        VALID,
        INVALID_SERVER_SIG,
        INVALID_WORKER_SIG,
        EXPIRED_TOKEN,
        TIME_DRIFT
    }
}