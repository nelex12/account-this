using System.Text.Json;
using System.Text.Json.Serialization;

namespace AccountThis.Api.Models;

// Enum в JSON — строго имя значения с учётом регистра, как в api.yaml («Значения в запросах»).
// Стандартный JsonStringEnumConverter принимает ещё числа и другой регистр: "role": "5" превращался
// в несуществующую роль (500 при регистрации), "condition": 0 — молча в Good, "owner" — в Owner.
// Ошибка разбора — JsonException: ASP.NET Core отвечает 400 с ключом errors по JSON-пути ($.role).
public sealed class StrictEnumConverter<TEnum> : JsonConverter<TEnum> where TEnum : struct, Enum
{
    public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            var value = reader.GetString();
            foreach (var name in Enum.GetNames<TEnum>())
            {
                if (string.Equals(name, value, StringComparison.Ordinal))
                {
                    return Enum.Parse<TEnum>(name);
                }
            }
        }

        throw new JsonException($"Допустимые значения: {string.Join(", ", Enum.GetNames<TEnum>())}");
    }

    public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString());
}
