using System.Text.Json;
using System.Text.Json.Serialization;

namespace AccountThis.Api.Models;

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
