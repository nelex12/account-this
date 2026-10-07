using System.Security.Claims;

namespace AccountThis.Api.Security;

public static class ClaimsPrincipalExtensions
{
    // Имя claim с id компании пользователя: его кладёт JwtTokenService, читает GetCompanyId
    public const string CompanyIdClaimType = "company_id";

    // id пользователя из claim sub. JwtBearer по умолчанию переименовывает sub в ClaimTypes.NameIdentifier,
    // поэтому проверяются оба имени — работает при любом значении MapInboundClaims.
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(value, out var userId))
        {
            throw new InvalidOperationException("В JWT нет корректного claim sub с id пользователя");
        }

        return userId;
    }

    // id компании пользователя из claim company_id. Компания пользователя не меняется, поэтому
    // доверять JWT можно: все запросы к данным ограничиваются этой компанией.
    public static Guid GetCompanyId(this ClaimsPrincipal user)
    {
        if (!Guid.TryParse(user.FindFirstValue(CompanyIdClaimType), out var companyId))
        {
            throw new InvalidOperationException($"В JWT нет корректного claim {CompanyIdClaimType} с id компании");
        }

        return companyId;
    }
}
