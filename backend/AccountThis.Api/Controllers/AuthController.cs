using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    /// <summary>
    /// Регистрация нового пользователя любой роли. Owner создаёт новую компанию (companyName) и подтверждается сразу
    /// (is_approved = true); Worker и Issuer присоединяются к существующей (companyId, который сообщил её Owner)
    /// и ждут подтверждения Owner этой компании (is_approved = false).
    /// Телефон нормализуется к +7XXXXXXXXXX и уникален (включая уволенных). Без авторизации.
    /// 400 — не заполнены поля компании для роли или компании с таким companyId нет; 409 — телефон уже занят.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var status = await authService.RegisterAsync(request, cancellationToken);
        return status switch
        {
            RegisterStatus.Created => StatusCode(StatusCodes.Status201Created),
            RegisterStatus.PhoneTaken => Problem(
                statusCode: StatusCodes.Status409Conflict,
                detail: "Пользователь с таким телефоном уже существует"),
            RegisterStatus.CompanyNotFound => CompanyNotFound(request.CompanyId),
            _ => throw new InvalidOperationException($"Неизвестный результат регистрации: {status}"),
        };
    }

    /// <summary>
    /// Вход в систему по телефону (нормализуется к +7XXXXXXXXXX) и паролю. Возвращает JWT на 12 часов.
    /// 401 — неверный телефон/пароль; 403 — аккаунт не подтверждён или уволен. Без авторизации.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    // 401/403 возвращает сам метод через Problem(...) — с телом ProblemDetails
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request, cancellationToken);
        return result.Status switch
        {
            LoginStatus.Success => new LoginResponse { AccessToken = result.AccessToken! },
            LoginStatus.InvalidCredentials => Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                detail: "Неверный телефон или пароль"),
            LoginStatus.NotApproved => Problem(
                statusCode: StatusCodes.Status403Forbidden,
                detail: "Аккаунт ещё не подтверждён владельцем"),
            LoginStatus.Deactivated => Problem(
                statusCode: StatusCodes.Status403Forbidden,
                detail: "Аккаунт деактивирован"),
            _ => throw new InvalidOperationException($"Неизвестный результат входа: {result.Status}"),
        };
    }

    /// <summary>
    /// Публичный ключ сервера (Ed25519) для оффлайн-верификации завхозом и время сервера. Без авторизации.
    /// </summary>
    [HttpGet("server-key")]
    [AllowAnonymous]
    public ActionResult<ServerKeyResponse> GetServerKey()
    {
        return authService.GetServerKey();
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
    public async Task<ActionResult<WorkerCertificate>> GetWorkerCert(CancellationToken cancellationToken)
    {
        var result = await authService.IssueWorkerCertificateAsync(User.GetUserId(), cancellationToken);
        return result.Status switch
        {
            WorkerCertStatus.Issued => result.Certificate!,
            WorkerCertStatus.NotApproved => Problem(
                statusCode: StatusCodes.Status403Forbidden,
                detail: "Аккаунт ещё не подтверждён владельцем, сертификат не выдаётся"),
            WorkerCertStatus.Deactivated => Problem(
                statusCode: StatusCodes.Status403Forbidden,
                detail: "Сотрудник уволен, сертификат не выдаётся"),
            _ => throw new InvalidOperationException($"Неизвестный результат выдачи сертификата: {result.Status}"),
        };
    }

    // companyId — поле запроса, поэтому ошибка ключом companyId в ValidationProblemDetails (400), а не 404
    private ActionResult CompanyNotFound(Guid? companyId)
    {
        ModelState.AddModelError("companyId", "Компания с таким id не найдена");
        return ValidationProblem(ModelState);
    }
}
