using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/companies")]
public class CompaniesController(ICompaniesService companiesService) : ControllerBase
{
    /// <summary>
    /// Своя компания (id и название). Owner сообщает этот id сотрудникам и завхозам, они указывают его при
    /// регистрации (companyId). Требуется авторизация, любая роль. Чужую компанию получить нельзя.
    /// </summary>
    [HttpGet("my")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Company>> GetMyCompany(CancellationToken cancellationToken)
    {
        var company = await companiesService.GetCompanyAsync(User.GetCompanyId(), cancellationToken);
        return company is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, detail: "Компания не найдена")
            : company;
    }
}
