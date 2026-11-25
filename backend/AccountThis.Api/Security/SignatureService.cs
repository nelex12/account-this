using Microsoft.IdentityModel.Tokens;
using NSec.Cryptography;
using System.Text;

namespace AccountThis.Api.Security;

public sealed record Ed25519KeyPair(string PrivateKey, string PublicKey);

public interface ISignatureService
{
    string ServerPublicKey { get; }

    string SignWithServerKey(string message);

    bool Verify(string publicKey, string message, string signature);

    // Временная пара для сертификата сотрудника
    Ed25519KeyPair GenerateKeyPair();
}

public class SignatureService : ISignatureService, IDisposable
{
    private readonly Key _key;
    private readonly SignatureAlgorithm _alg = SignatureAlgorithm.Ed25519;

    public string ServerPublicKey { get; }

    public SignatureService(IConfiguration configuration)
    {
        byte[] privateBytes = Base64UrlEncoder.DecodeBytes(configuration["SERVER_SIGNING_KEY"]!);
        if (privateBytes.Length != 32)
        {
            throw new InvalidOperationException(
                "SERVER_SIGNING_KEY должен быть 32-байтным seed Ed25519 в base64url. Сгенерируйте ключ заново (generate-keys.bat).");
        }

        _key = Key.Import(_alg, privateBytes, KeyBlobFormat.RawPrivateKey);

        byte[] publicBytes = _key.Export(KeyBlobFormat.RawPublicKey);
        ServerPublicKey = Base64UrlEncoder.Encode(publicBytes);
    }

    /// <summary>Подпись ключом сервера.</summary>
    public string SignWithServerKey(string message)
    {
        byte[] messageBytes = Encoding.ASCII.GetBytes(message);
        byte[] signatureBytes = _alg.Sign(_key, messageBytes);

        return Base64UrlEncoder.Encode(signatureBytes);
    }

    /// <summary>Проверка подписи.</summary>
    public bool Verify(string publicKey, string message, string signature)
    {
        try
        {
            var key = PublicKey.Import(_alg, Base64UrlEncoder.DecodeBytes(publicKey), KeyBlobFormat.RawPublicKey);
            bool result = _alg.Verify(key, Encoding.ASCII.GetBytes(message), Base64UrlEncoder.DecodeBytes(signature));
            return result;
        }
        catch
        {
                        return false;
        }
    }

    /// <summary>Генерация ключей Ed25519.</summary>
    public Ed25519KeyPair GenerateKeyPair()
    {
        using var newKey = Key.Create(_alg, new KeyCreationParameters
        {
            ExportPolicy = KeyExportPolicies.AllowPlaintextExport
        });

        byte[] privateBytes = newKey.Export(KeyBlobFormat.RawPrivateKey);
        byte[] publicBytes = newKey.PublicKey.Export(KeyBlobFormat.RawPublicKey);

        (string private_string, string public_string) = (Base64UrlEncoder.Encode(privateBytes), Base64UrlEncoder.Encode(publicBytes));

        return new Ed25519KeyPair(private_string, public_string);
    }

    public void Dispose()
    {
        _key.Dispose();
    }
}