using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AccountThis.Api.Models;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api")]
public class SyncController : ControllerBase
{
    /// <summary>
    /// Синхронизация оффлайн-выдач и возвратов. Каждая запись сохраняется независимо от
    /// результата проверки подписи (флаг проставляется в ValidationFlag). Требуется роль: Issuer.
    /// </summary>
    [HttpPost("sync")]
    [Authorize(Roles = "Issuer")]
    public IActionResult Sync([FromBody] List<OfflineRentalPayload> payloads)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Журнал движения инструментов, с фильтрами по action и toolId. Требуется роль: Issuer, Owner.
    /// </summary>
    [HttpGet("logs")]
    [Authorize(Roles = "Issuer,Owner")]
    public ActionResult<List<RentalLogEntry>> GetLogs([FromQuery] RentalAction? action, [FromQuery] int? toolId)
    {
        throw new NotImplementedException();
    }
}