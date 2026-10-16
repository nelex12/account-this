using AccountThis.Api.Events;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Microsoft.AspNetCore.WebUtilities;
using Npgsql;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;

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

// Причины Failed (нет токена, неизвестен, истёк, погашен, повтор, аккаунт уволен) клиенту не различаются
public enum RefreshStatus
{
    Success,
    Failed,
}

// AccessToken и RefreshToken заполнены только при Success
public sealed record RefreshResult(RefreshStatus Status, string? AccessToken = null, string? RefreshToken = null);

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

    // Ротация: предъявленный токен гасится, новый продолжает ту же сессию (family_id).
    // Повторное предъявление погашенного токена гасит всю сессию. Роль и компания для JWT — из БД.
    Task<RefreshResult> RefreshAsync(string? refreshToken, CancellationToken cancellationToken);

    // Гасит всю сессию предъявленного токена. Неизвестный, пустой или уже погашенный токен — не ошибка
    Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken);
}

public class AuthService(
    NpgsqlDataSource dataSource,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    ISignatureService signatureService,
    IEventPublisher eventPublisher,
    TimeProvider timeProvider) : IAuthService
{
    public static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    // Токен сертификата: camelCase-имена полей по api.yaml, UUID — строчные hex 8-4-4-4-12 (формат "D").
    // Кириллица не экранируется (\uXXXX втрое длиннее UTF-8), чтобы QR оставался коротким
    private static readonly JsonSerializerOptions TokenJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    };

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
                    "VALUES (@companyId, @fullName, @phone, @hash, @role::user_role) " +
                    "RETURNING id",
                    conn);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("companyId", request.CompanyId!.Value);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("fullName", request.FullName);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("phone", normalizedPhone);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("hash", hash);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("role", request.Role!.Value.ToString());
                var userId = (Guid)(await cmdAddWorkerOrIssuer.ExecuteScalarAsync(cancellationToken))!;

                PublishRegistered(request.CompanyId.Value, userId, request.Role.Value);
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
                    "VALUES (@companyId, @fullName, @phone, @hash, @role::user_role, True) " +
                    "RETURNING id",
                    conn,
                    transaction);
                cmdAddOwner.Parameters.AddWithValue("companyId", companyId);
                cmdAddOwner.Parameters.AddWithValue("fullName", request.FullName);
                cmdAddOwner.Parameters.AddWithValue("phone", normalizedPhone);
                cmdAddOwner.Parameters.AddWithValue("hash", hash);
                cmdAddOwner.Parameters.AddWithValue("role", request.Role!.Value.ToString());

                var ownerId = (Guid)(await cmdAddOwner.ExecuteScalarAsync(cancellationToken))!;

                await transaction.CommitAsync(cancellationToken);

                PublishRegistered(companyId, ownerId, UserRole.Owner);
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

    private void PublishRegistered(Guid companyId, Guid userId, UserRole role) =>
        eventPublisher.Publish(EventTypes.UserRegistered, companyId, userId, new { userId, role });

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

        // Вход начинает новую сессию: новый family_id
        var refreshToken = await InsertRefreshTokenAsync(conn, null, userId, Guid.NewGuid(), cancellationToken);

        eventPublisher.Publish(EventTypes.AuthLoggedIn, companyId, userId, new { });
        return new LoginResult(LoginStatus.Success, jwtToken, refreshToken);
    }

    public async Task<RefreshResult> RefreshAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (!TryHashRefreshToken(refreshToken, out var tokenHash))
        {
            return new RefreshResult(RefreshStatus.Failed);
        }

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

        // FOR UPDATE: два одновременных обмена одного токена выполняются по очереди,
        // второй увидит revoked_at первого и будет засчитан как повторное предъявление
        await using var cmdFind = new NpgsqlCommand(
            "SELECT rt.id, rt.family_id, rt.expires_at, rt.revoked_at, u.id, u.role::text, u.company_id, u.is_active " +
            "FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id " +
            "WHERE rt.token_hash = @tokenHash " +
            "FOR UPDATE OF rt",
            conn,
            transaction);
        cmdFind.Parameters.AddWithValue("tokenHash", tokenHash);

        long tokenId;
        Guid familyId, userId, companyId;
        long expiresAt;
        bool isRevoked, isActive;
        UserRole role;

        await using (var reader = await cmdFind.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken))
            {
                return new RefreshResult(RefreshStatus.Failed);
            }

            tokenId = reader.GetInt64(0);
            familyId = reader.GetGuid(1);
            expiresAt = reader.GetInt64(2);
            isRevoked = !reader.IsDBNull(3);
            userId = reader.GetGuid(4);
            role = Enum.Parse<UserRole>(reader.GetString(5));
            companyId = reader.GetGuid(6);
            isActive = reader.GetBoolean(7);
        }

        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();

        // Погашенный токен предъявлен снова — признак кражи: гасим всю сессию, включая выданный взамен токен.
        // Уволенному тоже гасим: сессия ему больше не нужна
        if (isRevoked || !isActive)
        {
            var revoked = await RevokeFamilyAsync(conn, transaction, familyId, now, cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Погасился хоть один токен — сессия была жива, а погашенным токеном воспользовались повторно (кража).
            // Ничего не погасилось — сессия уже была завершена (выход, увольнение), это не кража
            if (isRevoked && revoked > 0)
            {
                eventPublisher.Publish(EventTypes.AuthSessionReuseDetected, companyId, userId, new { });
            }

            return new RefreshResult(RefreshStatus.Failed);
        }

        if (expiresAt <= now)
        {
            return new RefreshResult(RefreshStatus.Failed);
        }

        await using var cmdRevoke = new NpgsqlCommand(
            "UPDATE refresh_tokens SET revoked_at = @now WHERE id = @id",
            conn,
            transaction);
        cmdRevoke.Parameters.AddWithValue("now", now);
        cmdRevoke.Parameters.AddWithValue("id", tokenId);
        await cmdRevoke.ExecuteNonQueryAsync(cancellationToken);

        var newRefreshToken = await InsertRefreshTokenAsync(conn, transaction, userId, familyId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var accessToken = jwtTokenService.CreateAccessToken(userId, role, companyId);
        return new RefreshResult(RefreshStatus.Success, accessToken, newRefreshToken);
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (!TryHashRefreshToken(refreshToken, out var tokenHash))
        {
            return;
        }

        // Гасится вся сессия, а не только предъявленный токен
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand(
            "UPDATE refresh_tokens SET revoked_at = @now " +
            "WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = @tokenHash) " +
            "AND revoked_at IS NULL",
            conn);
        cmd.Parameters.AddWithValue("now", timeProvider.GetUtcNow().ToUnixTimeSeconds());
        cmd.Parameters.AddWithValue("tokenHash", tokenHash);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    // Новый refresh token сессии familyId. В БД — только SHA-256 токена, клиенту — сам токен (base64url)
    private async Task<string> InsertRefreshTokenAsync(
        NpgsqlConnection conn, NpgsqlTransaction? transaction, Guid userId, Guid familyId, CancellationToken cancellationToken)
    {
        byte[] refreshTokenBytes = RandomNumberGenerator.GetBytes(32);
        var now = timeProvider.GetUtcNow();

        await using var cmd = new NpgsqlCommand(
            "INSERT INTO " +
            "refresh_tokens (user_id, family_id, token_hash, created_at, expires_at) " +
            "VALUES (@userId, @familyId, @tokenHash, @createdAt, @expiresAt)",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("userId", userId);
        cmd.Parameters.AddWithValue("familyId", familyId);
        cmd.Parameters.AddWithValue("tokenHash", SHA256.HashData(refreshTokenBytes));
        cmd.Parameters.AddWithValue("createdAt", now.ToUnixTimeSeconds());
        cmd.Parameters.AddWithValue("expiresAt", (now + RefreshTokenLifetime).ToUnixTimeSeconds());
        await cmd.ExecuteNonQueryAsync(cancellationToken);

        return WebEncoders.Base64UrlEncode(refreshTokenBytes);
    }

    private static async Task<int> RevokeFamilyAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid familyId, long now, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "UPDATE refresh_tokens SET revoked_at = @now WHERE family_id = @familyId AND revoked_at IS NULL",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("now", now);
        cmd.Parameters.AddWithValue("familyId", familyId);
        return await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    // Токен — base64url от 32 байт. Всё остальное (нет cookie, мусор) заведомо не найдётся в БД
    private static bool TryHashRefreshToken(string? refreshToken, out byte[] tokenHash)
    {
        tokenHash = [];
        if (string.IsNullOrEmpty(refreshToken))
        {
            return false;
        }

        byte[] tokenBytes;
        try
        {
            tokenBytes = WebEncoders.Base64UrlDecode(refreshToken);
        }
        catch (FormatException)
        {
            return false;
        }

        if (tokenBytes.Length != 32)
        {
            return false;
        }

        tokenHash = SHA256.HashData(tokenBytes);
        return true;
    }

    public ServerKeyResponse GetServerKey()
    {
        return new ServerKeyResponse { ServerPublicKey = signatureService.ServerPublicKey, ServerTime = timeProvider.GetUtcNow().ToUnixTimeSeconds() };
    }

    public async Task<WorkerCertResult> IssueWorkerCertificateAsync(Guid workerId, CancellationToken cancellationToken)
    {
        string fullName;
        await using (var conn = await dataSource.OpenConnectionAsync(cancellationToken))
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT full_name, is_approved, is_active FROM users WHERE id = @id",
                conn);
            cmd.Parameters.AddWithValue("id", workerId);

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            // Пользователя из действующего JWT нет в БД — сертификат не выдаётся, как уволенному
            if (!await reader.ReadAsync(cancellationToken) || !reader.GetBoolean(2))
            {
                return new WorkerCertResult(WorkerCertStatus.Deactivated);
            }

            if (!reader.GetBoolean(1))
            {
                return new WorkerCertResult(WorkerCertStatus.NotApproved);
            }

            fullName = reader.GetString(0);
        }

        // Приватный ключ отдаётся сотруднику и сервером не сохраняется
        var keyPair = signatureService.GenerateKeyPair();
        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();
        var tokenData = new ServerSignedToken
        {
            WorkerId = workerId,
            Fio = fullName,
            IssuedAt = now,
            ExpiresAt = now + (long)QrFormat.CertificateLifetime.TotalSeconds,
            WorkerPublicKey = keyPair.PublicKey,
        };

        var token = WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(tokenData, TokenJsonOptions));
        return new WorkerCertResult(WorkerCertStatus.Issued, new WorkerCertificate
        {
            Token = token,
            ServerSignature = signatureService.SignWithServerKey(QrFormat.TokenSignedData(token)),
            TemporaryPrivateKey = keyPair.PrivateKey,
            ServerTime = now,
        });
    }
}
