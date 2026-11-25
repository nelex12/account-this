using System.Text;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Microsoft.IdentityModel.Tokens;
using NSec.Cryptography;

namespace AccountThis.Api.Tests.Infrastructure;

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

    public static QrBuilder FromCertificate(WorkerCertificate certificate)
    {
        var workerKey = Key.Import(Ed25519, Base64UrlEncoder.DecodeBytes(certificate.TemporaryPrivateKey), KeyBlobFormat.RawPrivateKey);
        return new QrBuilder(certificate.Token, certificate.ServerSignature, workerKey);
    }

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

    public static string Encode(object value) =>
        Base64UrlEncoder.Encode(JsonSerializer.SerializeToUtf8Bytes(value));

    public static string EncodeRaw(string json) => Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(json));

    public void Dispose() => _workerKey.Dispose();
}
