using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

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
    /// Вход в систему по телефону (нормализуется к +7XXXXXXXXXX) и паролю. Возвращает JWT на 15 минут,
    /// refresh token на 30 дней — в cookie refresh_token.
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

        if (result.Status == LoginStatus.Success)
        {
            SetRefreshCookie(result.RefreshToken!);
        }

        return result.Status switch
        {
            LoginStatus.Success => TokenResponse(result.AccessToken!),
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

    /// <summary>
    /// Обмен refresh token из cookie на новую пару: access token в теле, refresh token в cookie (ротация).
    /// Повторное предъявление погашенного токена завершает всю сессию.
    /// 401 с удалением cookie — нет cookie, токен неизвестен, истёк, погашен или аккаунт уволен. Без JWT.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Refresh(CancellationToken cancellationToken)
    {
        var result = await authService.RefreshAsync(Request.Cookies[RefreshCookieName], cancellationToken);

        if (result.Status != RefreshStatus.Success)
        {
            ClearRefreshCookie();
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                detail: "Сессия завершена, войдите заново");
        }

        SetRefreshCookie(result.RefreshToken!);
        return TokenResponse(result.AccessToken!);
    }

    /// <summary>
    /// Выход: гасит сессию refresh token из cookie и удаляет cookie. Всегда 204, даже если сессии нет. Без JWT.
    /// </summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(Request.Cookies[RefreshCookieName], cancellationToken);
        ClearRefreshCookie();
        return NoContent();
    }

    private const string RefreshCookieName = "refresh_token";

    // Браузер отправляет cookie только на /api/auth/* и только с того же сайта; JavaScript её не видит
    private static CookieOptions RefreshCookieOptions() => new()
    {
        Path = "/api/auth",
        Secure = true,
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
    };

    private void SetRefreshCookie(string refreshToken)
    {
        var options = RefreshCookieOptions();
        options.MaxAge = AuthService.RefreshTokenLifetime;
        Response.Cookies.Append(RefreshCookieName, refreshToken, options);
    }

    // Пустое значение и Expires в прошлом, с тем же Path — иначе браузер не сопоставит cookie
    private void ClearRefreshCookie() => Response.Cookies.Delete(RefreshCookieName, RefreshCookieOptions());

    private static LoginResponse TokenResponse(string accessToken) => new()
    {
        AccessToken = accessToken,
        ExpiresIn = (int)JwtTokenService.AccessTokenLifetime.TotalSeconds,
    };
}
