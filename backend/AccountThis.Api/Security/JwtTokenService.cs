using AccountThis.Api.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AccountThis.Api.Security;

// JWT на 12 часов: claim sub — id пользователя, role — роль, company_id — id его компании
// (ClaimsPrincipalExtensions.CompanyIdClaimType); HMAC-SHA256 с секретом JWT_SIGNING_KEY
public interface IJwtTokenService
{
    string CreateAccessToken(Guid userId, UserRole role, Guid companyId);
}

public class JwtTokenService(IConfiguration configuration, TimeProvider timeProvider) : IJwtTokenService
{
    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromHours(12);

    /// <summary>
    /// Создает jwt токен на основе uuid пользователя, его роли и uuid компании. Токен подписан HMAC-SHA256 секретом из конфигурации JWT_SIGNING_KEY и действителен 12 часов.
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="role"></param>
    /// <param name="companyId"></param>
    /// <returns></returns>
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
