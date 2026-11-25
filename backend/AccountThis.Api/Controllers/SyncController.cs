using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api")]
public class SyncController(ISyncService syncService) : ControllerBase
{
    /// <summary>Синхронизация выдач и возвратов.</summary>
    [HttpPost("sync")]
    [Authorize(Roles = "Issuer")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<SyncResult>>> Sync([FromBody] List<SyncRecord?> records, CancellationToken cancellationToken)
    {
        var outcome = await syncService.SyncAsync(User.GetCompanyId(), User.GetUserId(), records, cancellationToken);
        if (outcome.IsRejected)
        {
            foreach (var (index, error) in outcome.FormatErrors)
            {
                ModelState.AddModelError($"[{index}].qr", error);
            }

            return ValidationProblem(ModelState);
        }

        return outcome.Results.ToList();
    }

    /// <summary>Журнал движения инструментов.</summary>
    [HttpGet("logs")]
    [Authorize(Roles = "Issuer,Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<RentalLogEntry>>> GetLogs([FromQuery] string? action, [FromQuery] Guid? toolId, CancellationToken cancellationToken)
    {
        RentalAction? parsedAction = null;
        if (action is not null)
        {
            if (!Enum.GetNames<RentalAction>().Contains(action, StringComparer.Ordinal))
            {
                ModelState.AddModelError("action", $"Допустимые значения: {string.Join(", ", Enum.GetNames<RentalAction>())}");
                return ValidationProblem(ModelState);
            }

            parsedAction = Enum.Parse<RentalAction>(action);
        }

        return await syncService.GetLogsAsync(User.GetCompanyId(), parsedAction, toolId, cancellationToken);
    }
}
