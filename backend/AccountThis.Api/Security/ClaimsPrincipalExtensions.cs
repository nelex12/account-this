using System.Security.Claims;

namespace AccountThis.Api.Security;

public static class ClaimsPrincipalExtensions
{
    // id пользователя из claim sub. JwtBearer по умолчанию переименовывает sub в ClaimTypes.NameIdentifier,
    // поэтому проверяются оба имени — работает при любом значении MapInboundClaims.
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(value, out var userId))
        {
            throw new InvalidOperationException("В JWT нет корректного claim sub с id пользователя");
        }

        return userId;
    }
}
