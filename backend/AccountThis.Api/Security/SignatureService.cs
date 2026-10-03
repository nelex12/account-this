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

public class SignatureService(IConfiguration configuration) : ISignatureService
{
    public string ServerPublicKey => throw new NotImplementedException();

    public string SignWithServerKey(string message)
    {
        throw new NotImplementedException();
    }

    public bool Verify(string publicKey, string message, string signature)
    {
        throw new NotImplementedException();
    }

    public Ed25519KeyPair GenerateKeyPair()
    {
        throw new NotImplementedException();
    }
}
