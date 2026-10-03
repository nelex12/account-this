using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Npgsql;

namespace AccountThis.Api.Services;

public enum RegisterStatus
{
    Created,
    PhoneTaken
}

public enum LoginStatus
{
    Success,
    InvalidCredentials,
    NotApproved,
    Deactivated
}

// AccessToken заполнен только при Success
public sealed record LoginResult(LoginStatus Status, string? AccessToken = null);

public enum WorkerCertStatus
{
    Issued,
    NotApproved,
    Deactivated
}

// Certificate заполнен только при Issued
public sealed record WorkerCertResult(WorkerCertStatus Status, WorkerCertificate? Certificate = null);

public interface IAuthService
{
    // Телефон нормализуется (PhoneFormat.Normalize), пароль хешируется; is_approved = false
    Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    ServerKeyResponse GetServerKey();

    // is_approved / is_active проверяются по БД в момент запроса, а не по JWT
    Task<WorkerCertResult> IssueWorkerCertificateAsync(int workerId, CancellationToken cancellationToken);
}

public class AuthService(
    NpgsqlDataSource dataSource,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    ISignatureService signatureService,
    TimeProvider timeProvider) : IAuthService
{
    public Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        // INSERT в users; нарушение UNIQUE(phone) (SqlState 23505) — PhoneTaken
        throw new NotImplementedException();
    }

    public Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        // Неизвестный телефон и неверный пароль неразличимы для клиента — оба InvalidCredentials.
        // is_approved / is_active проверяются только после верного пароля, чтобы не раскрывать статус чужого аккаунта.
        throw new NotImplementedException();
    }

    public ServerKeyResponse GetServerKey()
    {
        throw new NotImplementedException();
    }

    public Task<WorkerCertResult> IssueWorkerCertificateAsync(int workerId, CancellationToken cancellationToken)
    {
        // 1. Прочитать full_name, is_approved, is_active из users.
        // 2. Сгенерировать временную пару Ed25519 (приватный ключ не сохраняется).
        // 3. token = base64url(JSON ServerSignedToken), ExpiresAt = IssuedAt + QrFormat.CertificateLifetime.
        // 4. ServerSignature = подпись сервера над QrFormat.TokenSignaturePrefix + token.
        throw new NotImplementedException();
    }
}
