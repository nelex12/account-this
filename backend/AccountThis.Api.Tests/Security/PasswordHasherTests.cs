using AccountThis.Api.Security;

namespace AccountThis.Api.Tests.Security;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void Hash_DoesNotContainPassword()
    {
        var hash = _hasher.Hash("Secret123!");

        Assert.DoesNotContain("Secret123!", hash);
    }

    [Fact]
    public void Verify_CorrectPassword_ReturnsTrue()
    {
        var hash = _hasher.Hash("Secret123!");

        Assert.True(_hasher.Verify("Secret123!", hash));
    }

    [Theory]
    [InlineData("Secret123")]
    [InlineData("secret123!")]
    [InlineData("")]
    public void Verify_WrongPassword_ReturnsFalse(string wrongPassword)
    {
        var hash = _hasher.Hash("Secret123!");

        Assert.False(_hasher.Verify(wrongPassword, hash));
    }

    // Соль: одинаковые пароли разных пользователей не должны давать одинаковый хеш в БД
    [Fact]
    public void Hash_SamePasswordTwice_GivesDifferentHashes()
    {
        Assert.NotEqual(_hasher.Hash("Secret123!"), _hasher.Hash("Secret123!"));
    }

    // Хеш хранится в users.password_hash (VARCHAR): только текст, без управляющих символов
    [Fact]
    public void Hash_IsPrintableText()
    {
        var hash = _hasher.Hash("Пароль с кириллицей");

        Assert.All(hash, c => Assert.False(char.IsControl(c)));
        Assert.True(_hasher.Verify("Пароль с кириллицей", hash));
    }
}
