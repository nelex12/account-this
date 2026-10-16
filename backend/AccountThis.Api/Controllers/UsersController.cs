using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

// Все методы, кроме GET /api/users/me, требуют роль: Owner — и работают только с пользователями его компании
// (company_id из JWT). Пользователь другой компании неотличим от несуществующего: 404.
[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(IUsersService usersService) : ControllerBase
{
    /// <summary>
    /// Свой профиль, любая роль: пользователь из JWT (sub) в его компании (company_id).
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponse>> GetMe(CancellationToken cancellationToken)
    {
        var user = await usersService.GetMeAsync(User.GetCompanyId(), User.GetUserId(), cancellationToken);
        return user is null ? UserNotFound(User.GetUserId()) : user;
    }

    /// <summary>
    /// Список пользователей своей компании (включая неподтверждённых и уволенных).
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<List<UserResponse>>> GetUsers(CancellationToken cancellationToken)
    {
        return await usersService.GetUsersAsync(User.GetCompanyId(), cancellationToken);
    }

    /// <summary>
    /// Уволить/деактивировать пользователя своей компании (is_active = false). Повторный вызов — 200.
    /// Гасит все refresh token пользователя (все сессии). Выданный access token действует до 15 минут,
    /// офлайн-сертификат — до 12 часов (операции после увольнения получают WORKER_DEACTIVATED). 409 — попытка уволить самого себя.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeactivateUser(Guid id, CancellationToken cancellationToken)
    {
        var status = await usersService.DeactivateAsync(User.GetCompanyId(), User.GetUserId(), id, cancellationToken);
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
    /// Подтверждение регистрации пользователя своей компании (is_approved = true). Повторный вызов — 200.
    /// </summary>
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveUser(Guid id, CancellationToken cancellationToken)
    {
        return await usersService.ApproveAsync(User.GetCompanyId(), User.GetUserId(), id, cancellationToken) ? Ok() : UserNotFound(id);
    }

    private ObjectResult UserNotFound(Guid id) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Пользователь с id {id} не найден");
}
