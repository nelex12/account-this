using System.Diagnostics.CodeAnalysis;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;

namespace AccountThis.Shared.Events;

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

// Сообщение о событии (docs/events.md, «Сообщение»): одинаковый конверт у всех типов, Data — поля конкретного типа.
// Его пишет в outbox и отправляет в RabbitMQ API, читают потребители Worker
public sealed class EventMessage
{
    public const int MaxTypeLength = 64;

    public Guid EventId { get; init; }

    public string Type { get; init; } = string.Empty;

    public long OccurredAt { get; init; }

    public Guid CompanyId { get; init; }

    public Guid ActorId { get; init; }

    public JsonElement Data { get; init; }

    // camelCase, как в api.yaml; кириллица в названиях не экранируется
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
        Converters = { new JsonStringEnumConverter() },
    };

    public byte[] ToUtf8Bytes() => JsonSerializer.SerializeToUtf8Bytes(this, JsonOptions);

    // Строгий разбор тела сообщения: все поля конверта обязательны, data — JSON-объект.
    // false — сообщение не по контракту (его место — в очереди отказов, а не в повторной обработке)
    public static bool TryParse(ReadOnlyMemory<byte> body, [NotNullWhen(true)] out EventMessage? message)
    {
        message = null;
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !TryGetGuid(root, "eventId", out var eventId)
                || !root.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String
                || !root.TryGetProperty("occurredAt", out var occurredAt) || occurredAt.ValueKind != JsonValueKind.Number
                || !occurredAt.TryGetInt64(out var occurredAtValue)
                || !TryGetGuid(root, "companyId", out var companyId)
                || !TryGetGuid(root, "actorId", out var actorId)
                || !root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var typeValue = type.GetString()!;
            if (typeValue.Length is 0 or > MaxTypeLength)
            {
                return false;
            }

            message = new EventMessage
            {
                EventId = eventId,
                Type = typeValue,
                OccurredAt = occurredAtValue,
                CompanyId = companyId,
                ActorId = actorId,
                Data = data.Clone(),
            };
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryGetGuid(JsonElement root, string name, out Guid value)
    {
        value = Guid.Empty;
        return root.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            && property.TryGetGuid(out value);
    }
}
