using System.Security.Claims;

namespace AccountThis.Api.Security;

public static class ClaimsPrincipalExtensions
{
    public const string CompanyIdClaimType = "company_id";

    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(value, out var userId))
        {
            throw new InvalidOperationException("В JWT нет корректного claim sub с id пользователя");
        }

        return userId;
    }

    public static Guid GetCompanyId(this ClaimsPrincipal user)
    {
        if (!Guid.TryParse(user.FindFirstValue(CompanyIdClaimType), out var companyId))
        {
            throw new InvalidOperationException($"В JWT нет корректного claim {CompanyIdClaimType} с id компании");
        }

        return companyId;
    }
}
