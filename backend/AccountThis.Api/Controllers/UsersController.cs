using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AccountThis.Api.Models;

namespace AccountThis.Api.Controllers;

// Все методы контроллера требуют роль: Owner.
[ApiController]
[Route("api/users")]
[Authorize(Roles = "Owner")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Список всех пользователей (включая неподтверждённых и уволенных).
    /// </summary>
    [HttpGet]
    public ActionResult<List<UserResponse>> GetUsers()
    {
        throw new NotImplementedException();
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
    public IActionResult DeactivateUser(int id)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Подтверждение регистрации пользователя (is_approved = true). Повторный вызов — 200.
    /// </summary>
    [HttpPost("{id}/approve")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult ApproveUser(int id)
    {
        throw new NotImplementedException();
    }
}
