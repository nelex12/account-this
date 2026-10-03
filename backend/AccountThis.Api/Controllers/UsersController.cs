using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

// Все методы контроллера требуют роль: Owner.
[ApiController]
[Route("api/users")]
[Authorize(Roles = "Owner")]
public class UsersController(IUsersService usersService) : ControllerBase
{
    /// <summary>
    /// Список всех пользователей (включая неподтверждённых и уволенных).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<UserResponse>>> GetUsers(CancellationToken cancellationToken)
    {
        return await usersService.GetUsersAsync(cancellationToken);
    }

    /// <summary>
    /// Уволить/деактивировать пользователя (is_active = false). Повторный вызов — 200.
    /// Выданные JWT/сертификаты не отзываются. 409 — попытка уволить самого себя.
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeactivateUser(int id, CancellationToken cancellationToken)
    {
        var status = await usersService.DeactivateAsync(User.GetUserId(), id, cancellationToken);
        return status switch
        {
            DeactivateUserStatus.Deactivated => Ok(),
            DeactivateUserStatus.NotFound => UserNotFound(id),
            DeactivateUserStatus.SelfDeactivation => Problem(
                statusCode: StatusCodes.Status409Conflict,
                detail: "Нельзя уволить самого себя"),
            _ => throw new InvalidOperationException($"Неизвестный результат увольнения: {status}"),
        };
    }

    /// <summary>
    /// Подтверждение регистрации пользователя (is_approved = true). Повторный вызов — 200.
    /// </summary>
    [HttpPost("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveUser(int id, CancellationToken cancellationToken)
    {
        return await usersService.ApproveAsync(id, cancellationToken) ? Ok() : UserNotFound(id);
    }

    private ObjectResult UserNotFound(int id) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Пользователь с id {id} не найден");
}
