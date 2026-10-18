using AccountThis.Api.Models;
using AccountThis.Api.Services;
using AccountThis.Api.Tests.Infrastructure;
using Microsoft.IdentityModel.Tokens;

namespace AccountThis.Api.Tests.Security;

// Строгий разбор строки QR по правилам OfflineRentalPayload (api.yaml). Подписи здесь не проверяются —
// только формат; нарушение любого правила — строка не по формату (на /api/sync это 400).
public class QrPayloadParserTests
{
    private static readonly Guid WorkerId = Guid.Parse("5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21");
    private static readonly Guid ToolId = Guid.Parse("17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35");

    private static readonly string Signature = Base64UrlEncoder.Encode(new byte[64]);
    private static readonly string PublicKey = Base64UrlEncoder.Encode(new byte[32]);

    private const string ValidTokenJson =
        """{"workerId":"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21","fio":"Иванов Иван","issuedAt":1790000000,"expiresAt":1790043200,"workerPublicKey":"PUBKEY"}""";

    private const string ValidOpJson =
        """{"action":"TAKE","toolCondition":"Damaged","toolId":"17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35","toolName":"Дрель","timestamp":1790003600}""";

    private static string Token(string json = ValidTokenJson) => QrBuilder.EncodeRaw(json.Replace("PUBKEY", PublicKey));

    private static string Op(string json = ValidOpJson) => QrBuilder.EncodeRaw(json);

    private static string Qr(string? token = null, string? serverSig = null, string? op = null, string? workerSig = null) =>
        $"AT1.{token ?? Token()}.{serverSig ?? Signature}.{op ?? Op()}.{workerSig ?? Signature}";

    [Fact]
    public void ValidString_ParsesAllFieldsAndKeepsRawParts()
    {
        var token = Token();
        var op = Op();

        Assert.True(QrPayloadParser.TryParse(Qr(token, op: op), out var payload, out var error), error);

        Assert.Equal(token, payload.Token);
        Assert.Equal(op, payload.Op);
        Assert.Equal(Signature, payload.ServerSignature);
        Assert.Equal(Signature, payload.WorkerSignature);
        Assert.Equal(WorkerId, payload.TokenData.WorkerId);
        Assert.Equal("Иванов Иван", payload.TokenData.Fio);
        Assert.Equal(1790000000, payload.TokenData.IssuedAt);
        Assert.Equal(1790043200, payload.TokenData.ExpiresAt);
        Assert.Equal(PublicKey, payload.TokenData.WorkerPublicKey);
        Assert.Equal(RentalAction.TAKE, payload.Operation.Action);
        Assert.Equal(ToolCondition.Damaged, payload.Operation.ToolCondition);
        Assert.Equal(ToolId, payload.Operation.ToolId);
        Assert.Equal("Дрель", payload.Operation.ToolName);
        Assert.Equal(1790003600, payload.Operation.Timestamp);
    }

    // Порядок полей, пробелы и лишние поля значения не имеют
    [Fact]
    public void ExtraFieldsAndWhitespace_AreAccepted()
    {
        var op = """ { "extra": [1, 2], "timestamp": 1790003600, "toolName": "Дрель", "toolId": "17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35", "toolCondition": "Good", "action": "GIVE" } """;

        Assert.True(QrPayloadParser.TryParse(Qr(op: Op(op)), out var payload, out var error), error);
        Assert.Equal(RentalAction.GIVE, payload.Operation.Action);
    }

    public static TheoryData<string> MalformedStrings => new()
    {
        // Части и версия
        "",
        "AT1",
        $"AT1.{Token()}.{Signature}.{Op()}",
        $"AT1.{Token()}.{Signature}.{Op()}.{Signature}.extra",
        $"AT2.{Token()}.{Signature}.{Op()}.{Signature}",
        $"at1.{Token()}.{Signature}.{Op()}.{Signature}",
        // base64url: без паддинга, только A–Z a–z 0–9 - _
        $"AT1.{Token()}=.{Signature}.{Op()}.{Signature}",
        $"AT1.{Token()}.{Signature}.{Op()}.{Signature[..^2]}+/",
        $"AT1..{Signature}.{Op()}.{Signature}",
        // Длина n % 4 == 1 невозможна в base64url (86 + 3 = 89 символов)
        $"AT1.{Token()}.{Signature}.{Op()}.{Signature}AAA",
        // Длины подписей и ключа
        $"AT1.{Token()}.{Base64UrlEncoder.Encode(new byte[63])}.{Op()}.{Signature}",
        $"AT1.{Token()}.{Signature}.{Op()}.{Base64UrlEncoder.Encode(new byte[65])}",
        $"AT1.{QrBuilder.EncodeRaw(ValidTokenJson.Replace("PUBKEY", Base64UrlEncoder.Encode(new byte[31])))}.{Signature}.{Op()}.{Signature}",
        // token и op — JSON-объекты в UTF-8
        $"AT1.{QrBuilder.EncodeRaw("not json")}.{Signature}.{Op()}.{Signature}",
        $"AT1.{Token()}.{Signature}.{QrBuilder.EncodeRaw("[1,2]")}.{Signature}",
        $"AT1.{Base64UrlEncoder.Encode(new byte[] { 0x7B, 0x22, 0xFF, 0x22, 0x3A, 0x31, 0x7D })}.{Signature}.{Op()}.{Signature}",
    };

    [Theory]
    [MemberData(nameof(MalformedStrings))]
    public void MalformedString_IsRejectedWithFormatMessage(string qr)
    {
        Assert.False(QrPayloadParser.TryParse(qr, out var payload, out var error));
        Assert.Null(payload);
        Assert.StartsWith("Строка не соответствует формату AT1", error);
    }

    [Fact]
    public void WrongNumberOfParts_ExplainsExpectedFormat()
    {
        QrPayloadParser.TryParse("AT1.a.b", out _, out var error);

        Assert.Equal("Строка не соответствует формату AT1: ожидается 5 частей через точку", error);
    }

    // Все поля обязательны, строки — JSON-строки (не null), целые — JSON-числа без дробной части
    [Theory]
    [InlineData("\"workerId\":\"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21\",", "")]
    [InlineData("\"fio\":\"Иванов Иван\"", "\"fio\":null")]
    [InlineData("\"fio\":\"Иванов Иван\"", "\"fio\":42")]
    [InlineData("\"issuedAt\":1790000000", "\"issuedAt\":\"1790000000\"")]
    [InlineData("\"issuedAt\":1790000000", "\"issuedAt\":1790000000.5")]
    [InlineData("\"issuedAt\":1790000000", "\"issuedAt\":1790000000.0")]
    [InlineData("\"issuedAt\":1790000000", "\"issuedAt\":1.79e9")]
    [InlineData("\"expiresAt\":1790043200", "\"expiresAt\":99999999999999999999")]
    // UUID — ровно канонический вид: строчные hex, 8-4-4-4-12
    [InlineData("5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21", "5B1D0C8A-2F4E-4A63-9D17-8E0C3A6F4B21")]
    [InlineData("\"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21\"", "\"{5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21}\"")]
    [InlineData("\"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21\"", "\"5b1d0c8a2f4e4a639d178e0c3a6f4b21\"")]
    // Поле, указанное дважды, неоднозначно
    [InlineData("\"fio\":\"Иванов Иван\"", "\"fio\":\"Иванов Иван\",\"fio\":\"Другой\"")]
    public void InvalidTokenField_IsRejected(string original, string replacement)
    {
        var token = QrBuilder.EncodeRaw(ValidTokenJson.Replace(original, replacement).Replace("PUBKEY", PublicKey));

        Assert.False(QrPayloadParser.TryParse(Qr(token), out _, out _));
    }

    // action и toolCondition — строго значения enum с учётом регистра
    [Theory]
    [InlineData("\"action\":\"TAKE\"", "\"action\":\"take\"")]
    [InlineData("\"action\":\"TAKE\"", "\"action\":0")]
    [InlineData("\"action\":\"TAKE\"", "\"action\":\"0\"")]
    [InlineData("\"action\":\"TAKE\"", "\"action\":\"RETURN\"")]
    [InlineData("\"toolCondition\":\"Damaged\"", "\"toolCondition\":\"damaged\"")]
    [InlineData("\"toolCondition\":\"Damaged\",", "")]
    [InlineData("\"toolId\":\"17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35\"", "\"toolId\":null")]
    [InlineData("\"toolName\":\"Дрель\"", "\"toolName\":null")]
    [InlineData("\"timestamp\":1790003600", "\"timestamp\":\"1790003600\"")]
    public void InvalidOperationField_IsRejected(string original, string replacement)
    {
        var op = QrBuilder.EncodeRaw(ValidOpJson.Replace(original, replacement));

        Assert.False(QrPayloadParser.TryParse(Qr(op: op), out _, out _));
    }
}
