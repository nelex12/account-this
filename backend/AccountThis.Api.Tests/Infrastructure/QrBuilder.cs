using System.Text;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Microsoft.IdentityModel.Tokens;
using NSec.Cryptography;

namespace AccountThis.Api.Tests.Infrastructure;

// Строка QR сотрудника "AT1.<token>.<serverSignature>.<op>.<workerSignature>", собранная прямо по api.yaml
// (OfflineRentalPayload), независимо от сервера. Сертификат либо подделывается тестом (любой срок, любой ключ сервера),
// либо берётся настоящий из /api/auth/worker-cert.
public sealed class QrBuilder : IDisposable
{
    private static readonly SignatureAlgorithm Ed25519 = SignatureAlgorithm.Ed25519;

    private readonly Key _workerKey;

    public string Token { get; }

    public string ServerSignature { get; }

    private QrBuilder(string token, string serverSignature, Key workerKey)
    {
        Token = token;
        ServerSignature = serverSignature;
        _workerKey = workerKey;
    }

    public static long Now => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    // Сертификат, подписанный ключом сервера serverPrivateKey (по умолчанию — настоящим тестовым ключом сервера).
    // По умолчанию выдан час назад и действует 12 часов
    public static QrBuilder Forge(
        Guid workerId,
        string fio = "Иванов Иван Иванович",
        long? issuedAt = null,
        long? expiresAt = null,
        string serverPrivateKey = TestKeys.ServerPrivateKey)
    {
        var workerKey = Key.Create(Ed25519, new KeyCreationParameters { ExportPolicy = KeyExportPolicies.AllowPlaintextExport });
        var issued = issuedAt ?? Now - 3600;
        var token = Encode(new
        {
            workerId,
            fio,
            issuedAt = issued,
            expiresAt = expiresAt ?? issued + 12 * 60 * 60,
            workerPublicKey = Base64UrlEncoder.Encode(workerKey.PublicKey.Export(KeyBlobFormat.RawPublicKey)),
        });

        using var server = new SignatureService(TestKeys.Configuration(serverPrivateKey));
        return new QrBuilder(token, server.SignWithServerKey("AT1-TOKEN." + token), workerKey);
    }

    // Настоящий сертификат сервера: строки token и serverSignature используются в точности как получены
    public static QrBuilder FromCertificate(WorkerCertificate certificate)
    {
        var workerKey = Key.Import(Ed25519, Base64UrlEncoder.DecodeBytes(certificate.TemporaryPrivateKey), KeyBlobFormat.RawPrivateKey);
        return new QrBuilder(certificate.Token, certificate.ServerSignature, workerKey);
    }

    // timestamp по умолчанию — сейчас. signWithForeignKey — подпись операции чужим ключом (не парой к workerPublicKey)
    public string Qr(
        RentalAction action,
        Guid toolId,
        long? timestamp = null,
        ToolCondition condition = ToolCondition.Good,
        string toolName = "Дрель Bosch GSB 16 RE",
        bool signWithForeignKey = false)
    {
        var op = Encode(new
        {
            action = action.ToString(),
            toolCondition = condition.ToString(),
            toolId,
            toolName,
            timestamp = timestamp ?? Now,
        });

        var signedData = Encoding.ASCII.GetBytes("AT1-OP." + Token + "." + ServerSignature + "." + op);
        byte[] signature;
        if (signWithForeignKey)
        {
            using var foreignKey = Key.Create(Ed25519);
            signature = Ed25519.Sign(foreignKey, signedData);
        }
        else
        {
            signature = Ed25519.Sign(_workerKey, signedData);
        }

        return $"AT1.{Token}.{ServerSignature}.{op}.{Base64UrlEncoder.Encode(signature)}";
    }

    // base64url(UTF-8 JSON) без паддинга
    public static string Encode(object value) =>
        Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(value));

    public static string EncodeRaw(string json) => Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(json));

    public void Dispose() => _workerKey.Dispose();
}
