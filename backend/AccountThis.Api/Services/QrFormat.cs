using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.RegularExpressions;
using AccountThis.Api.Models;
using Microsoft.AspNetCore.WebUtilities;

namespace AccountThis.Api.Services;

public static class QrFormat
{
    public const string Version = "AT1";

    // Подпись сервера ставится над TokenSignaturePrefix + token
    public const string TokenSignaturePrefix = "AT1-TOKEN.";

    public const string OperationSignaturePrefix = "AT1-OP.";

    public static readonly TimeSpan CertificateLifetime = TimeSpan.FromHours(12);

    public const int SignatureLength = 64;

    public const int PublicKeyLength = 32;

    public static string TokenSignedData(string token) => TokenSignaturePrefix + token;

    public static string OperationSignedData(string token, string serverSignature, string op) =>
        OperationSignaturePrefix + token + "." + serverSignature + "." + op;
}

// Подписи проверяются по исходным строкам QR.
public sealed record QrPayload(
    string Token,
    string ServerSignature,
    string Op,
    string WorkerSignature,
    ServerSignedToken TokenData,
    RentalOperation Operation);

public static partial class QrPayloadParser
{
    private const string ErrorPrefix = "Строка не соответствует формату AT1: ";

    public static bool TryParse(
        string qr,
        [NotNullWhen(true)] out QrPayload? payload,
        [NotNullWhen(false)] out string? error)
    {
        payload = null;
        try
        {
            payload = Parse(qr);
            error = null;
            return true;
        }
        catch (QrFormatException ex)
        {
            error = ErrorPrefix + ex.Message;
            return false;
        }
    }

    private static QrPayload Parse(string qr)
    {
        var parts = qr.Split('.');
        if (parts.Length != 5)
        {
            throw new QrFormatException("ожидается 5 частей через точку");
        }

        if (parts[0] != QrFormat.Version)
        {
            throw new QrFormatException($"первая часть должна быть {QrFormat.Version}");
        }

        var tokenBytes = DecodeBase64Url(parts[1], "token");
        var serverSignature = DecodeBase64Url(parts[2], "serverSignature");
        var opBytes = DecodeBase64Url(parts[3], "op");
        var workerSignature = DecodeBase64Url(parts[4], "workerSignature");

        if (serverSignature.Length != QrFormat.SignatureLength)
        {
            throw new QrFormatException($"serverSignature должна быть {QrFormat.SignatureLength} байта");
        }

        if (workerSignature.Length != QrFormat.SignatureLength)
        {
            throw new QrFormatException($"workerSignature должна быть {QrFormat.SignatureLength} байта");
        }

        return new QrPayload(parts[1], parts[2], parts[3], parts[4], ParseToken(tokenBytes), ParseOperation(opBytes));
    }

    private static ServerSignedToken ParseToken(byte[] json)
    {
        using var document = ParseObject(json, "token");
        var root = document.RootElement;

        var token = new ServerSignedToken
        {
            WorkerId = GetUuid(root, "token", "workerId"),
            Fio = GetString(root, "token", "fio"),
            IssuedAt = GetInteger(root, "token", "issuedAt"),
            ExpiresAt = GetInteger(root, "token", "expiresAt"),
            WorkerPublicKey = GetString(root, "token", "workerPublicKey"),
        };

        var publicKey = DecodeBase64Url(token.WorkerPublicKey, "workerPublicKey");
        if (publicKey.Length != QrFormat.PublicKeyLength)
        {
            throw new QrFormatException($"workerPublicKey должен быть {QrFormat.PublicKeyLength} байта");
        }

        return token;
    }

    private static RentalOperation ParseOperation(byte[] json)
    {
        using var document = ParseObject(json, "op");
        var root = document.RootElement;

        return new RentalOperation
        {
            Action = GetEnum<RentalAction>(root, "op", "action"),
            ToolCondition = GetEnum<ToolCondition>(root, "op", "toolCondition"),
            ToolId = GetUuid(root, "op", "toolId"),
            ToolName = GetString(root, "op", "toolName"),
            Timestamp = GetInteger(root, "op", "timestamp"),
        };
    }

    private static byte[] DecodeBase64Url(string value, string name)
    {
        if (value.Length == 0 || !Base64UrlRegex().IsMatch(value) || value.Length % 4 == 1)
        {
            throw new QrFormatException($"{name} должен быть в base64url без паддинга");
        }

        return WebEncoders.Base64UrlDecode(value);
    }

    // JsonDocument проверяет и сам JSON, и корректность UTF-8
    private static JsonDocument ParseObject(byte[] json, string name)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            throw new QrFormatException($"{name} не является UTF-8 JSON");
        }

        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            document.Dispose();
            throw new QrFormatException($"{name} должен быть JSON-объектом");
        }

        return document;
    }

    // Дубликаты ключей делают подпись неоднозначной.
    private static JsonElement GetField(JsonElement root, string objectName, string field)
    {
        JsonElement? found = null;
        foreach (var property in root.EnumerateObject())
        {
            if (property.NameEquals(field))
            {
                if (found is not null)
                {
                    throw new QrFormatException($"поле {objectName}.{field} указано больше одного раза");
                }

                found = property.Value;
            }
        }

        return found ?? throw new QrFormatException($"нет обязательного поля {objectName}.{field}");
    }

    private static string GetString(JsonElement root, string objectName, string field)
    {
        var value = GetField(root, objectName, field);
        if (value.ValueKind != JsonValueKind.String)
        {
            throw new QrFormatException($"поле {objectName}.{field} должно быть строкой");
        }

        return value.GetString()!;
    }

    private static long GetInteger(JsonElement root, string objectName, string field)
    {
        var value = GetField(root, objectName, field);
        if (value.ValueKind != JsonValueKind.Number || !IntegerRegex().IsMatch(value.GetRawText()) || !value.TryGetInt64(out var number))
        {
            throw new QrFormatException($"поле {objectName}.{field} должно быть целым числом");
        }

        return number;
    }

    private static Guid GetUuid(JsonElement root, string objectName, string field)
    {
        var value = GetString(root, objectName, field);
        if (!CanonicalUuidRegex().IsMatch(value))
        {
            throw new QrFormatException($"поле {objectName}.{field} должно быть UUID в каноническом виде (строчные hex, 8-4-4-4-12)");
        }

        return Guid.ParseExact(value, "D");
    }

    private static TEnum GetEnum<TEnum>(JsonElement root, string objectName, string field) where TEnum : struct, Enum
    {
        var value = GetString(root, objectName, field);
        foreach (var name in Enum.GetNames<TEnum>())
        {
            if (string.Equals(name, value, StringComparison.Ordinal))
            {
                return Enum.Parse<TEnum>(name);
            }
        }

        throw new QrFormatException($"поле {objectName}.{field} должно быть одним из: {string.Join(", ", Enum.GetNames<TEnum>())}");
    }

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex Base64UrlRegex();

    [GeneratedRegex("^-?(0|[1-9][0-9]*)$")]
    private static partial Regex IntegerRegex();

    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
    private static partial Regex CanonicalUuidRegex();

    private sealed class QrFormatException(string message) : Exception(message);
}
