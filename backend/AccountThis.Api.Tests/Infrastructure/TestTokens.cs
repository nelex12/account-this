using System.IdentityModel.Tokens.Jwt;
using AccountThis.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace AccountThis.Api.Tests.Infrastructure;

// JWT, собранный прямо по api.yaml (claims sub / role / company_id, HS256), независимо от JwtTokenService:
// так тесты middleware не зависят от того, правильно ли реализована выдача токена.
public static class TestTokens
{
    public static string Create(
        UserRole role,
        Guid? userId = null,
        Guid? companyId = null,
        DateTime? expires = null,
        string signingKey = TestKeys.JwtSigningKey)
    {
        var expiresAt = expires ?? DateTime.UtcNow.AddHours(1);
        var descriptor = new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                ["sub"] = (userId ?? Guid.NewGuid()).ToString(),
                ["role"] = role.ToString(),
                ["company_id"] = (companyId ?? Guid.NewGuid()).ToString(),
            },
            IssuedAt = expiresAt.AddHours(-12),
            NotBefore = expiresAt.AddHours(-12),
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Base64UrlEncoder.DecodeBytes(signingKey)),
                SecurityAlgorithms.HmacSha256),
        };

        return new JwtSecurityTokenHandler().CreateEncodedJwt(descriptor);
    }
}
