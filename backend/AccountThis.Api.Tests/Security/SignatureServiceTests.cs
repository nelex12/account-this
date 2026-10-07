using AccountThis.Api.Security;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Security;

// Ed25519 по RFC 8032; ключи и подписи — base64url без паддинга (api.yaml, «Формат QR и подписей»)
public class SignatureServiceTests
{
    private readonly SignatureService _service = new(TestKeys.Configuration());

    [Fact]
    public void ServerPublicKey_IsDerivedFromServerPrivateKey()
    {
        Assert.Equal(TestKeys.ServerPublicKey, _service.ServerPublicKey);
    }

    [Theory]
    [InlineData("", TestKeys.SignatureOfEmptyMessage)]
    [InlineData("AT1-TOKEN.abc", TestKeys.SignatureOfTokenAbc)]
    public void SignWithServerKey_MatchesReferenceSignature(string message, string expected)
    {
        // Ed25519 детерминирован: одно сообщение и один ключ всегда дают одну и ту же подпись
        Assert.Equal(expected, _service.SignWithServerKey(message));
    }

    [Fact]
    public void Verify_ReferenceSignature_ReturnsTrue()
    {
        Assert.True(_service.Verify(TestKeys.ServerPublicKey, "AT1-TOKEN.abc", TestKeys.SignatureOfTokenAbc));
    }

    [Fact]
    public void Verify_ChangedMessage_ReturnsFalse()
    {
        Assert.False(_service.Verify(TestKeys.ServerPublicKey, "AT1-TOKEN.abd", TestKeys.SignatureOfTokenAbc));
    }

    // В /api/sync ключи и подписи приходят из QR, то есть от клиента. Мусор — это флаг INVALID_*_SIG,
    // а не исключение и 500 на весь запрос.
    [Theory]
    [InlineData("not-base64!!", TestKeys.SignatureOfTokenAbc)]
    [InlineData(TestKeys.ServerPublicKey, "not-base64!!")]
    [InlineData("AAAA", TestKeys.SignatureOfTokenAbc)]
    [InlineData(TestKeys.ServerPublicKey, "AAAA")]
    [InlineData("", "")]
    public void Verify_MalformedKeyOrSignature_ReturnsFalse(string publicKey, string signature)
    {
        Assert.False(_service.Verify(publicKey, "AT1-TOKEN.abc", signature));
    }

    [Fact]
    public void GenerateKeyPair_Returns32ByteKeysInBase64Url()
    {
        var pair = _service.GenerateKeyPair();

        // 32 байта в base64url без паддинга — ровно 43 символа
        Assert.Matches("^[A-Za-z0-9_-]{43}$", pair.PrivateKey);
        Assert.Matches("^[A-Za-z0-9_-]{43}$", pair.PublicKey);
    }

    [Fact]
    public void GenerateKeyPair_PublicKeyMatchesPrivateKey()
    {
        var pair = _service.GenerateKeyPair();

        // Сервис, у которого ключом сервера стал сгенерированный приватный ключ, должен вывести тот же публичный
        var withGeneratedKey = new SignatureService(TestKeys.Configuration(pair.PrivateKey));

        Assert.Equal(pair.PublicKey, withGeneratedKey.ServerPublicKey);
    }

    [Fact]
    public void GenerateKeyPair_ReturnsNewPairEachTime()
    {
        Assert.NotEqual(_service.GenerateKeyPair().PrivateKey, _service.GenerateKeyPair().PrivateKey);
    }
}
