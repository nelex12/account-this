using AccountThis.Api.Models;

namespace AccountThis.Api.Security;

// JWT на 12 часов: claim sub — id пользователя, role — роль; HMAC-SHA256 с секретом JWT_SIGNING_KEY
public interface IJwtTokenService
{
    string CreateAccessToken(int userId, UserRole role);
}

public class JwtTokenService(IConfiguration configuration, TimeProvider timeProvider) : IJwtTokenService
{
    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromHours(12);

    public string CreateAccessToken(int userId, UserRole role)
    {
        throw new NotImplementedException();
    }
}
