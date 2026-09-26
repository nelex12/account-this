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
    /// Список всех пользователей.
    /// </summary>
    [HttpGet]
    public ActionResult<List<UserResponse>> GetUsers()
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Уволить/деактивировать пользователя (is_active = false).
    /// </summary>
    [HttpDelete("{id}")]
    public IActionResult DeactivateUser(int id)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Подтверждение регистрации пользователя (is_approved = true).
    /// </summary>
    [HttpPost("{id}/approve")]
    public IActionResult ApproveUser(int id)
    {
        throw new NotImplementedException();
    }
}