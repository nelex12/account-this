using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Microsoft.AspNetCore.WebUtilities;
using Npgsql;
using System.Security.Cryptography;

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

// AccessToken и RefreshToken заполнены только при Success
public sealed record LoginResult(LoginStatus Status, string? AccessToken = null, string? RefreshToken = null);

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
    public static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    public async Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        // Owner — в одной транзакции: INSERT в companies, затем в users (role = Owner, is_approved = true).
        //   Нарушение UNIQUE(phone) (SqlState 23505) — PhoneTaken, а компания при этом не создаётся (откат транзакции).
        // Worker / Issuer — INSERT в users с company_id = CompanyId, is_approved = false.
        //   Нарушение внешнего ключа company_id (SqlState 23503) — CompanyNotFound; UNIQUE(phone) — PhoneTaken.
        // Различать нарушенное ограничение по PostgresException.ConstraintName.
        // id компании и пользователя выдаёт БД (gen_random_uuid()): INSERT ... RETURNING id.
        var normalizedPhone = PhoneFormat.Normalize(request.Phone);
        var hash = passwordHasher.Hash(request.Password);

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);

        try
        {
            if (request.Role == UserRole.Worker || request.Role == UserRole.Issuer)
            {
                await using var cmdAddWorkerOrIssuer = new NpgsqlCommand(
                    "INSERT INTO " +
                    "users (company_id, full_name, phone, password_hash, role) " +
                    "VALUES (@companyId, @fullName, @phone, @hash, @role::user_role)",
                    conn);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("companyId", request.CompanyId!.Value);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("fullName", request.FullName);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("phone", normalizedPhone);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("hash", hash);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("role", request.Role!.Value.ToString());
                await cmdAddWorkerOrIssuer.ExecuteNonQueryAsync(cancellationToken);

                return RegisterStatus.Created;
            }
            else if (request.Role == UserRole.Owner)
            {
                await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

                await using var cmdCreateCompany = new NpgsqlCommand(
                    "INSERT INTO " +
                    "companies (name) " +
                    "VALUES (@name) " +
                    "RETURNING id",
                    conn,
                    transaction);

                cmdCreateCompany.Parameters.AddWithValue("name", request.CompanyName!);

                var result = await cmdCreateCompany.ExecuteScalarAsync(cancellationToken);
                var companyId = (Guid)result!;


                await using var cmdAddOwner = new NpgsqlCommand(
                    "INSERT INTO " +
                    "users (company_id, full_name, phone, password_hash, role, is_approved) " +
                    "VALUES (@companyId, @fullName, @phone, @hash, @role::user_role, True)",
                    conn,
                    transaction);
                cmdAddOwner.Parameters.AddWithValue("companyId", companyId);
                cmdAddOwner.Parameters.AddWithValue("fullName", request.FullName);
                cmdAddOwner.Parameters.AddWithValue("phone", normalizedPhone);
                cmdAddOwner.Parameters.AddWithValue("hash", hash);
                cmdAddOwner.Parameters.AddWithValue("role", request.Role!.Value.ToString());

                await cmdAddOwner.ExecuteNonQueryAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                return RegisterStatus.Created;

            }
        }
        catch (PostgresException ex) when (ex.ConstraintName == "users_phone_key")
        {
            return RegisterStatus.PhoneTaken;
        }
        catch (PostgresException ex) when (ex.ConstraintName == "users_company_id_fkey")
        {
            return RegisterStatus.CompanyNotFound;
        }
        throw new ArgumentOutOfRangeException(nameof(request), $"Неизвестная роль: {request.Role}");
    }

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        // Неизвестный телефон и неверный пароль неразличимы для клиента — оба InvalidCredentials.
        // is_approved / is_active проверяются только после верного пароля, чтобы не раскрывать статус чужого аккаунта.
        // В JWT кладётся id, роль и company_id пользователя: CreateAccessToken(id, role, companyId).
        var normalizedPhone = PhoneFormat.Normalize(request.Phone);
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);

        
        await using var cmd = new NpgsqlCommand(
                    "SELECT id, role::text, company_id, is_approved, is_active, password_hash " +
                    "FROM users " +
                    "WHERE phone = @phone",
                    conn);
        cmd.Parameters.AddWithValue("phone", normalizedPhone);

        await using var userReader = await cmd.ExecuteReaderAsync(cancellationToken);
        var hasRow = await userReader.ReadAsync(cancellationToken);
        if (!hasRow)
        {
            return new LoginResult(LoginStatus.InvalidCredentials);
        }

        var storedHash = userReader.GetString(5);
        var isActive = userReader.GetBoolean(4);
        var isApproved = userReader.GetBoolean(3);
        bool hashedPasswordMatches = passwordHasher.Verify(request.Password, storedHash);
        if (!hashedPasswordMatches)
        {
            return new LoginResult(LoginStatus.InvalidCredentials);
        }
        else if (!isActive)
        {
            return new LoginResult(LoginStatus.Deactivated);
        }
        else if (!isApproved)
        {
            return new LoginResult(LoginStatus.NotApproved);
        }


        var userId = userReader.GetGuid(0);
        var companyId = userReader.GetGuid(2);
        var userRole = Enum.Parse<UserRole>(userReader.GetString(1));
        var jwtToken = jwtTokenService.CreateAccessToken(userId, userRole, companyId);

        // Пока reader открыт, другую команду на этом соединении выполнить нельзя
        await userReader.CloseAsync();

        // Вход начинает новую сессию: новый family_id. В БД — только SHA-256 токена
        byte[] refreshTokenBytes = RandomNumberGenerator.GetBytes(32);
        byte[] refreshTokenHash = SHA256.HashData(refreshTokenBytes);
        var now = timeProvider.GetUtcNow();

        await using var cmdAddRefreshToken = new NpgsqlCommand(
                    "INSERT INTO " +
                    "refresh_tokens (user_id, family_id, token_hash, created_at, expires_at) " +
                    "VALUES (@userId, @familyId, @tokenHash, @createdAt, @expiresAt)",
                    conn);
        cmdAddRefreshToken.Parameters.AddWithValue("userId", userId);
        cmdAddRefreshToken.Parameters.AddWithValue("familyId", Guid.NewGuid());
        cmdAddRefreshToken.Parameters.AddWithValue("tokenHash", refreshTokenHash);
        cmdAddRefreshToken.Parameters.AddWithValue("createdAt", now.ToUnixTimeSeconds());
        cmdAddRefreshToken.Parameters.AddWithValue("expiresAt", (now + RefreshTokenLifetime).ToUnixTimeSeconds());
        await cmdAddRefreshToken.ExecuteNonQueryAsync(cancellationToken);

        var refreshToken = WebEncoders.Base64UrlEncode(refreshTokenBytes);
        return new LoginResult(LoginStatus.Success, jwtToken, refreshToken);
    }

    public ServerKeyResponse GetServerKey()
    {
        return new ServerKeyResponse { ServerPublicKey = signatureService.ServerPublicKey, ServerTime = timeProvider.GetUtcNow().ToUnixTimeSeconds() };
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
