using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

// Уведомления Owner своей компании (company_id из JWT). Чужое уведомление неотличимо от несуществующего: 404.
[ApiController]
[Route("api/notifications")]
[Authorize(Roles = "Owner")]
public class NotificationsController(INotificationsService notificationsService) : ControllerBase
{
    /// <summary>
    /// Последние 100 уведомлений компании, новые сверху. Создаются асинхронно (AccountThis.Worker по событиям RabbitMQ).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<Notification>>> GetNotifications(CancellationToken cancellationToken)
    {
        return await notificationsService.GetAsync(User.GetCompanyId(), cancellationToken);
    }

    /// <summary>
    /// Отметить уведомление прочитанным. Повторный вызов — 200.
    /// </summary>
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
