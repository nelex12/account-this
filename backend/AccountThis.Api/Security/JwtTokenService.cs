using AccountThis.Api.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AccountThis.Api.Security;

public interface IJwtTokenService
{
    string CreateAccessToken(Guid userId, UserRole role, Guid companyId);
}

public class JwtTokenService(IConfiguration configuration, TimeProvider timeProvider) : IJwtTokenService
{
    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);

    /// <summary>Выпуск токена доступа.</summary>
    public string CreateAccessToken(Guid userId, UserRole role, Guid companyId)
    {
        var secret = configuration["JWT_SIGNING_KEY"];
        var now = timeProvider.GetUtcNow().UtcDateTime;

        var keyBytes = Base64UrlEncoder.DecodeBytes(secret);   // текст - байты
        var key = new SymmetricSecurityKey(keyBytes);              // байты - ключ

        var descriptor = new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                ["sub"] = userId.ToString(),
                ["role"] = role.ToString(),
                [ClaimsPrincipalExtensions.CompanyIdClaimType] = companyId.ToString(),
            },
            IssuedAt = now,
            NotBefore = now,
            Expires = now + AccessTokenLifetime,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);

    }
}
