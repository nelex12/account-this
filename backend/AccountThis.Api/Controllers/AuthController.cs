using AccountThis.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// Регистрация нового пользователя. Создаёт аккаунт со статусом is_approved = false.
    /// Без авторизации.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public IActionResult Register([FromBody] RegisterRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Вход в систему по телефону и паролю. Возвращает JWT. Без авторизации.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public ActionResult<LoginResponse> Login([FromBody] LoginRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Публичный ключ сервера (Ed25519) для оффлайн-верификации завхозом. Без авторизации.
    /// </summary>
    [HttpGet("server-key")]
    [AllowAnonymous]
    public ActionResult<ServerKeyResponse> GetServerKey()
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Выдача временного сертификата и ключа сотруднику. Требуется роль: Worker.
    /// </summary>
    [HttpGet("worker-cert")]
    [Authorize(Roles = "Worker")]
    public ActionResult<WorkerCertificate> GetWorkerCert()
    {
        throw new NotImplementedException();
    }
}