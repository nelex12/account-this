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
    /// <summary>
    /// Синхронизация оффлайн-выдач и возвратов. Сервер сам разбирает каждую строку QR и сохраняет
    /// каждую запись независимо от результата проверок подписей и времени (флаг — в ValidationFlag).
    /// Строка не по формату AT1 — 400 для всего запроса с номерами таких записей (ValidationProblemDetails,
    /// ключи вида "[3].qr"), ничего не сохраняется. Повторно отправленная запись (тот же issuer, ScannedAt
    /// и строка QR) не дублируется. Результаты — в порядке запроса.
    /// Требуется роль: Issuer.
    /// </summary>
    [HttpPost("sync")]
    [Authorize(Roles = "Issuer")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<SyncResult>>> Sync([FromBody] List<SyncRecord> records, CancellationToken cancellationToken)
    {
        var outcome = await syncService.SyncAsync(User.GetUserId(), records, cancellationToken);
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

    /// <summary>
    /// Журнал движения инструментов: новые сверху (qr_timestamp DESC, id DESC), с фильтрами по action и toolId.
    /// Требуется роль: Issuer, Owner.
    /// </summary>
    [HttpGet("logs")]
    [Authorize(Roles = "Issuer,Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<RentalLogEntry>>> GetLogs([FromQuery] RentalAction? action, [FromQuery] int? toolId, CancellationToken cancellationToken)
    {
        return await syncService.GetLogsAsync(action, toolId, cancellationToken);
    }
}
