using AccountThis.Api.Models;

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

    public string CreateAccessToken(Guid userId, UserRole role, Guid companyId)
    {
        throw new NotImplementedException();
    }
}
