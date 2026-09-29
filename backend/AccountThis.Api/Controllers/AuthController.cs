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
    /// Телефон нормализуется к +7XXXXXXXXXX и уникален (включая уволенных). Без авторизации.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public IActionResult Register([FromBody] RegisterRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Вход в систему по телефону (нормализуется к +7XXXXXXXXXX) и паролю. Возвращает JWT на 12 часов.
    /// 401 — неверный телефон/пароль; 403 — аккаунт не подтверждён или уволен. Без авторизации.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    // 401/403 возвращает сам метод (Unauthorized(), Problem(statusCode: 403)) — с телом ProblemDetails
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public ActionResult<LoginResponse> Login([FromBody] LoginRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Публичный ключ сервера (Ed25519) для оффлайн-верификации завхозом и время сервера. Без авторизации.
    /// </summary>
    [HttpGet("server-key")]
    [AllowAnonymous]
    public ActionResult<ServerKeyResponse> GetServerKey()
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Выдача временного сертификата (на 12 часов) и ключа сотруднику.
    /// Выдаётся только подтверждённому и не уволенному (проверка по БД, иначе 403). Требуется роль: Worker.
    /// </summary>
    [HttpGet("worker-cert")]
    [Authorize(Roles = "Worker")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    // 401 и 403 по роли отдаёт проверка JWT без тела; 403 по is_approved/is_active (проверка по БД) — ProblemDetails
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public ActionResult<WorkerCertificate> GetWorkerCert()
    {
        throw new NotImplementedException();
    }
}
