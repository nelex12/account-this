using Microsoft.IdentityModel.Tokens;
using NSec.Cryptography;
using System.Text;

namespace AccountThis.Api.Security;

// Ключи — сырые байты в base64url без паддинга: приватный — 32-байтный seed, публичный — 32 байта
public sealed record Ed25519KeyPair(string PrivateKey, string PublicKey);

// Ed25519 (RFC 8032). Ключ сервера — SERVER_SIGNING_KEY; подписываются ASCII-строки, подписи — 64 байта в base64url.
public interface ISignatureService
{
    string ServerPublicKey { get; }

    string SignWithServerKey(string message);

    // Подпись ключом сервера проверяется так же: Verify(ServerPublicKey, ...)
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

        _key = Key.Import(_alg, privateBytes, KeyBlobFormat.RawPrivateKey);

        byte[] publicBytes = _key.Export(KeyBlobFormat.RawPublicKey);
        ServerPublicKey = Base64UrlEncoder.Encode(publicBytes);
    }

    /// <summary>
    /// Возвращает строку — подпись ключом сервера
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public string SignWithServerKey(string message)
    {
        byte[] messageBytes = Encoding.ASCII.GetBytes(message);
        byte[] signatureBytes = _alg.Sign(_key, messageBytes);

        return Base64UrlEncoder.Encode(signatureBytes);
    }

    /// <summary>
    /// Проверяет подпись к данным
    /// </summary>
    /// <param name="publicKey"></param>
    /// <param name="message"></param>
    /// <param name="signature"></param>
    /// <returns></returns>
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

    /// <summary>
    /// Создаёт пару ключей Ed25519 (приватный и публичный)
    /// </summary>
    /// <returns></returns>
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