using System.Text.Json;
using System.Text.Json.Serialization;

namespace AccountThis.Api.Events;

// Типы событий = routing key (docs/events.md, «Типы событий»)
public static class EventTypes
{
    public const string UserRegistered = "user.registered";
    public const string UserApproved = "user.approved";
    public const string UserDeactivated = "user.deactivated";
    public const string AuthLoggedIn = "auth.logged_in";
    public const string AuthSessionReuseDetected = "auth.session_reuse_detected";
    public const string ToolCreated = "tool.created";
    public const string ToolUpdated = "tool.updated";
    public const string ToolWrittenOff = "tool.written_off";
    public const string RentalSynced = "rental.synced";
}

// Тело сообщения (docs/events.md, «Сообщение»). Data — поля события, свои у каждого типа
public sealed class AuditEvent
{
    public Guid EventId { get; init; }

    public string Type { get; init; } = string.Empty;

    public long OccurredAt { get; init; }

    public Guid CompanyId { get; init; }

    public Guid ActorId { get; init; }

    public JsonElement Data { get; init; }

    // camelCase, как в api.yaml; кириллица в названиях не экранируется
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All),
        Converters = { new JsonStringEnumConverter() },
    };

    public static AuditEvent Create(string type, Guid companyId, Guid actorId, object data, long occurredAt) => new()
    {
        EventId = Guid.NewGuid(),
        Type = type,
        OccurredAt = occurredAt,
        CompanyId = companyId,
        ActorId = actorId,
        Data = JsonSerializer.SerializeToElement(data, JsonOptions),
    };
}
