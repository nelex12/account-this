using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Npgsql;

namespace AccountThis.Api.Services;

public enum RegisterStatus
{
    Created,
    PhoneTaken,

    // Worker / Issuer: компании с таким CompanyId нет
    CompanyNotFound
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
    // Телефон нормализуется (PhoneFormat.Normalize), пароль хешируется.
    // Owner: создаёт компанию (CompanyName) и сам подтверждается (is_approved = true) — подтверждать некому.
    // Worker / Issuer: присоединяются к существующей компании (CompanyId, который сообщил её Owner), is_approved = false.
    Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    ServerKeyResponse GetServerKey();

    // is_approved / is_active проверяются по БД в момент запроса, а не по JWT
    Task<WorkerCertResult> IssueWorkerCertificateAsync(Guid workerId, CancellationToken cancellationToken);
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
        // Owner — в одной транзакции: INSERT в companies, затем в users (role = Owner, is_approved = true).
        //   Нарушение UNIQUE(phone) (SqlState 23505) — PhoneTaken, а компания при этом не создаётся (откат транзакции).
        // Worker / Issuer — INSERT в users с company_id = CompanyId, is_approved = false.
        //   Нарушение внешнего ключа company_id (SqlState 23503) — CompanyNotFound; UNIQUE(phone) — PhoneTaken.
        // Различать нарушенное ограничение по PostgresException.ConstraintName.
        // id компании и пользователя выдаёт БД (gen_random_uuid()): INSERT ... RETURNING id.
        throw new NotImplementedException();
    }

    public Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        // Неизвестный телефон и неверный пароль неразличимы для клиента — оба InvalidCredentials.
        // is_approved / is_active проверяются только после верного пароля, чтобы не раскрывать статус чужого аккаунта.
        // В JWT кладётся id, роль и company_id пользователя: CreateAccessToken(id, role, companyId).
        throw new NotImplementedException();
    }

    public ServerKeyResponse GetServerKey()
    {
        throw new NotImplementedException();
    }

    public Task<WorkerCertResult> IssueWorkerCertificateAsync(Guid workerId, CancellationToken cancellationToken)
    {
        // 1. Прочитать full_name, is_approved, is_active из users.
        // 2. Сгенерировать временную пару Ed25519 (приватный ключ не сохраняется).
        // 3. token = base64url(JSON ServerSignedToken), ExpiresAt = IssuedAt + QrFormat.CertificateLifetime.
        // 4. ServerSignature = подпись сервера над QrFormat.TokenSignaturePrefix + token.
        throw new NotImplementedException();
    }
}
