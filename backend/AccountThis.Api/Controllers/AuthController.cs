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
    /// <summary>Регистрация пользователя.</summary>
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

    /// <summary>Вход по телефону и паролю.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
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

    /// <summary>Публичный ключ и время сервера.</summary>
    [HttpGet("server-key")]
    [AllowAnonymous]
    public ActionResult<ServerKeyResponse> GetServerKey()
    {
        return authService.GetServerKey();
    }

    /// <summary>Выдача сертификата сотруднику.</summary>
    [HttpGet("worker-cert")]
    [Authorize(Roles = "Worker")]
    [ProducesResponseType(StatusCodes.Status200OK)]
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

    private ActionResult CompanyNotFound(Guid? companyId)
    {
        ModelState.AddModelError("companyId", "Компания с таким id не найдена");
        return ValidationProblem(ModelState);
    }

    /// <summary>Обновление токенов.</summary>
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

    /// <summary>Завершение сессии.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(Request.Cookies[RefreshCookieName], cancellationToken);
        ClearRefreshCookie();
        return NoContent();
    }

    /// <summary>Смена пароля.</summary>
    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LoginResponse>> ChangePassword(
        [FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.ChangePasswordAsync(User.GetCompanyId(), User.GetUserId(), request, cancellationToken);
        switch (result.Status)
        {
            case ChangePasswordStatus.Changed:
                SetRefreshCookie(result.RefreshToken!);
                return TokenResponse(result.AccessToken!);

            case ChangePasswordStatus.WrongCurrentPassword:
                ModelState.AddModelError("currentPassword", "Неверный текущий пароль");
                return ValidationProblem(ModelState);

            case ChangePasswordStatus.Deactivated:
                return Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    detail: "Аккаунт деактивирован");

            default:
                throw new InvalidOperationException($"Неизвестный результат смены пароля: {result.Status}");
        }
    }

    private const string RefreshCookieName = "refresh_token";

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

    private void ClearRefreshCookie() => Response.Cookies.Delete(RefreshCookieName, RefreshCookieOptions());

    private static LoginResponse TokenResponse(string accessToken) => new()
    {
        AccessToken = accessToken,
        ExpiresIn = (int)JwtTokenService.AccessTokenLifetime.TotalSeconds,
    };
}
