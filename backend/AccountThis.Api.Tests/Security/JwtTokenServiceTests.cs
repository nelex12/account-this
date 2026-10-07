using System.IdentityModel.Tokens.Jwt;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Tests.Infrastructure;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.Tokens;

namespace AccountThis.Api.Tests.Security;

// Контракт из api.yaml, раздел «Авторизация»: claims sub / role / company_id, HMAC-SHA256 с JWT_SIGNING_KEY, 12 часов
public class JwtTokenServiceTests
{
    // Время в будущем: если сервис возьмёт DateTime.UtcNow вместо TimeProvider, срок действия не совпадёт
    private static readonly DateTimeOffset Now = new(2030, 1, 1, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid UserId = Guid.Parse("3f2b8c1e-0000-4000-8000-000000000001");
    private static readonly Guid CompanyId = Guid.Parse("3f2b8c1e-0000-4000-8000-0000000000c0");

    private readonly JwtTokenService _service = new(TestKeys.Configuration(), new FakeTimeProvider(Now));

    [Fact]
    public void Token_ContainsUserRoleAndCompanyClaims()
    {
        var token = Read(_service.CreateAccessToken(UserId, UserRole.Issuer, CompanyId));

        Assert.Equal(UserId.ToString(), token.Payload.Sub);
        Assert.Equal("Issuer", token.Payload["role"]);
        Assert.Equal(CompanyId.ToString(), token.Payload["company_id"]);
    }

    [Fact]
    public void Token_ExpiresIn12HoursFromTimeProvider()
    {
        var token = Read(_service.CreateAccessToken(UserId, UserRole.Worker, CompanyId));

        Assert.Equal(Now.AddHours(12).UtcDateTime, token.ValidTo);
    }

    [Fact]
    public void Token_IsSignedWithHs256AndJwtSigningKey()
    {
        var jwt = _service.CreateAccessToken(UserId, UserRole.Owner, CompanyId);

        var result = Validate(jwt, TestKeys.JwtSigningKey);

        Assert.True(result.IsValid, result.Exception?.Message);
        Assert.Equal(SecurityAlgorithms.HmacSha256, Read(jwt).Header.Alg);
    }

    [Fact]
    public void Token_DoesNotValidateWithAnotherKey()
    {
        var jwt = _service.CreateAccessToken(UserId, UserRole.Owner, CompanyId);

        var result = Validate(jwt, "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc");

        Assert.False(result.IsValid);
    }

    private static JwtSecurityToken Read(string jwt) => new JwtSecurityTokenHandler().ReadJwtToken(jwt);

    private static TokenValidationResult Validate(string jwt, string key) =>
        new JwtSecurityTokenHandler().ValidateTokenAsync(jwt, new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Base64UrlEncoder.DecodeBytes(key)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false,
        }).GetAwaiter().GetResult();
}
