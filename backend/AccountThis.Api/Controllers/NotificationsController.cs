using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = "Owner")]
public class NotificationsController(INotificationsService notificationsService) : ControllerBase
{
    /// <summary>Последние уведомления компании.</summary>
    [HttpGet]
    public async Task<ActionResult<List<Notification>>> GetNotifications(CancellationToken cancellationToken)
    {
        return await notificationsService.GetAsync(User.GetCompanyId(), cancellationToken);
    }

    /// <summary>Отметка о прочтении.</summary>
    [HttpPost("{id}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkNotificationRead(long id, CancellationToken cancellationToken)
    {
        return await notificationsService.MarkReadAsync(User.GetCompanyId(), id, cancellationToken)
            ? Ok()
            : Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Уведомление с id {id} не найдено");
    }
}
