using AccountThis.Api.Events;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Shared.Events;
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

public enum ChangePasswordStatus
{
    Changed,
    WrongCurrentPassword,

    Deactivated
}

public sealed record ChangePasswordResult(ChangePasswordStatus Status, string? AccessToken = null, string? RefreshToken = null);

public interface IAuthService
{
    Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    ServerKeyResponse GetServerKey();

    Task<WorkerCertResult> IssueWorkerCertificateAsync(Guid workerId, CancellationToken cancellationToken);

    Task<RefreshResult> RefreshAsync(string? refreshToken, CancellationToken cancellationToken);

    Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken);

    Task<ChangePasswordResult> ChangePasswordAsync(
        Guid companyId, Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken);
}

public class AuthService(
    NpgsqlDataSource dataSource,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    ISignatureService signatureService,
    IEventOutbox eventOutbox,
    TimeProvider timeProvider) : IAuthService
{
    public static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    public static readonly TimeSpan RefreshReuseGrace = TimeSpan.FromSeconds(30);

    private static readonly JsonSerializerOptions TokenJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    };

    public async Task<RegisterStatus> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var normalizedPhone = PhoneFormat.Normalize(request.Phone);
        var hash = passwordHasher.Hash(request.Password);

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);

        try
        {
            if (request.Role == UserRole.Worker || request.Role == UserRole.Issuer)
            {
                await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

                await using var cmdAddWorkerOrIssuer = new NpgsqlCommand(
                    "INSERT INTO " +
                    "users (company_id, full_name, phone, password_hash, role) " +
                    "VALUES (@companyId, @fullName, @phone, @hash, @role::user_role) " +
                    "RETURNING id",
                    conn,
                    transaction);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("companyId", request.CompanyId!.Value);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("fullName", request.FullName);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("phone", normalizedPhone);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("hash", hash);
                cmdAddWorkerOrIssuer.Parameters.AddWithValue("role", request.Role!.Value.ToString());
                var userId = (Guid)(await cmdAddWorkerOrIssuer.ExecuteScalarAsync(cancellationToken))!;

                await AddRegisteredEventAsync(conn, transaction, request.CompanyId.Value, userId, request.Role.Value, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
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

                await AddRegisteredEventAsync(conn, transaction, companyId, ownerId, UserRole.Owner, cancellationToken);
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

    private Task AddRegisteredEventAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid companyId, Guid userId, UserRole role, CancellationToken cancellationToken) =>
        eventOutbox.AddAsync(conn, transaction, EventTypes.UserRegistered, companyId, userId, new { userId, role }, cancellationToken);

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
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

        await userReader.CloseAsync();

        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);
        var (_, refreshToken) = await InsertRefreshTokenAsync(conn, transaction, userId, Guid.NewGuid(), cancellationToken);
        await eventOutbox.AddAsync(conn, transaction, EventTypes.AuthLoggedIn, companyId, userId, new { }, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

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

        await using var cmdFind = new NpgsqlCommand(
            "SELECT rt.id, rt.family_id, rt.expires_at, rt.revoked_at, rt.replaced_by, " +
            "u.id, u.role::text, u.company_id, u.is_active " +
            "FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id " +
            "WHERE rt.token_hash = @tokenHash " +
            "FOR UPDATE OF rt",
            conn,
            transaction);
        cmdFind.Parameters.AddWithValue("tokenHash", tokenHash);

        long tokenId;
        Guid familyId, userId, companyId;
        long expiresAt;
        long? revokedAt, replacedBy;
        bool isActive;
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
            revokedAt = reader.IsDBNull(3) ? null : reader.GetInt64(3);
            replacedBy = reader.IsDBNull(4) ? null : reader.GetInt64(4);
            userId = reader.GetGuid(5);
            role = Enum.Parse<UserRole>(reader.GetString(6));
            companyId = reader.GetGuid(7);
            isActive = reader.GetBoolean(8);
        }

        var isRevoked = revokedAt is not null;
        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();

        if (isActive
            && expiresAt > now
            && replacedBy is long successorId
            && now - revokedAt!.Value <= (long)RefreshReuseGrace.TotalSeconds
            && await TryRevokeUnusedSuccessorAsync(conn, transaction, successorId, now, cancellationToken))
        {
            var (retryTokenId, retryToken) = await InsertRefreshTokenAsync(conn, transaction, userId, familyId, cancellationToken);

            // Повторы не продлевают окно ротации.
            await using var cmdRelink = new NpgsqlCommand(
                "UPDATE refresh_tokens SET replaced_by = @newId WHERE id = @id",
                conn,
                transaction);
            cmdRelink.Parameters.AddWithValue("newId", retryTokenId);
            cmdRelink.Parameters.AddWithValue("id", tokenId);
            await cmdRelink.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new RefreshResult(RefreshStatus.Success, jwtTokenService.CreateAccessToken(userId, role, companyId), retryToken);
        }

        if (isRevoked || !isActive)
        {
            var revoked = await RevokeFamilyAsync(conn, transaction, familyId, now, cancellationToken);

            if (isRevoked && revoked > 0)
            {
                await eventOutbox.AddAsync(conn, transaction, EventTypes.AuthSessionReuseDetected, companyId, userId, new { }, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return new RefreshResult(RefreshStatus.Failed);
        }

        if (expiresAt <= now)
        {
            return new RefreshResult(RefreshStatus.Failed);
        }

        var (newTokenId, newRefreshToken) = await InsertRefreshTokenAsync(conn, transaction, userId, familyId, cancellationToken);

        await using var cmdRevoke = new NpgsqlCommand(
            "UPDATE refresh_tokens SET revoked_at = @now, replaced_by = @newId WHERE id = @id",
            conn,
            transaction);
        cmdRevoke.Parameters.AddWithValue("now", now);
        cmdRevoke.Parameters.AddWithValue("newId", newTokenId);
        cmdRevoke.Parameters.AddWithValue("id", tokenId);
        await cmdRevoke.ExecuteNonQueryAsync(cancellationToken);
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

    public async Task<ChangePasswordResult> ChangePasswordAsync(
        Guid companyId, Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

        UserRole role;
        string storedHash;
        await using (var cmdFind = new NpgsqlCommand(
            "SELECT role::text, is_active, password_hash FROM users WHERE id = @id AND company_id = @companyId FOR UPDATE",
            conn,
            transaction))
        {
            cmdFind.Parameters.AddWithValue("id", userId);
            cmdFind.Parameters.AddWithValue("companyId", companyId);

            await using var reader = await cmdFind.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken) || !reader.GetBoolean(1))
            {
                return new ChangePasswordResult(ChangePasswordStatus.Deactivated);
            }

            role = Enum.Parse<UserRole>(reader.GetString(0));
            storedHash = reader.GetString(2);
        }

        if (!passwordHasher.Verify(request.CurrentPassword, storedHash))
        {
            return new ChangePasswordResult(ChangePasswordStatus.WrongCurrentPassword);
        }

        await using (var cmdUpdate = new NpgsqlCommand(
            "UPDATE users SET password_hash = @hash WHERE id = @id",
            conn,
            transaction))
        {
            cmdUpdate.Parameters.AddWithValue("hash", passwordHasher.Hash(request.NewPassword));
            cmdUpdate.Parameters.AddWithValue("id", userId);
            await cmdUpdate.ExecuteNonQueryAsync(cancellationToken);
        }

        int revokedSessions;
        await using (var cmdRevoke = new NpgsqlCommand(
            "WITH revoked AS (" +
            "  UPDATE refresh_tokens SET revoked_at = @now WHERE user_id = @id AND revoked_at IS NULL RETURNING family_id" +
            ") SELECT count(DISTINCT family_id)::int FROM revoked",
            conn,
            transaction))
        {
            cmdRevoke.Parameters.AddWithValue("now", timeProvider.GetUtcNow().ToUnixTimeSeconds());
            cmdRevoke.Parameters.AddWithValue("id", userId);
            revokedSessions = (int)(await cmdRevoke.ExecuteScalarAsync(cancellationToken))!;
        }

        var (_, refreshToken) = await InsertRefreshTokenAsync(conn, transaction, userId, Guid.NewGuid(), cancellationToken);
        await eventOutbox.AddAsync(conn, transaction, EventTypes.AuthPasswordChanged, companyId, userId,
            new { revokedSessions }, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var accessToken = jwtTokenService.CreateAccessToken(userId, role, companyId);
        return new ChangePasswordResult(ChangePasswordStatus.Changed, accessToken, refreshToken);
    }

    private static async Task<bool> TryRevokeUnusedSuccessorAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, long successorId, long now, CancellationToken cancellationToken)
    {
        await using (var cmdLock = new NpgsqlCommand(
            "SELECT revoked_at IS NULL AND expires_at > @now FROM refresh_tokens WHERE id = @id FOR UPDATE",
            conn,
            transaction))
        {
            cmdLock.Parameters.AddWithValue("id", successorId);
            cmdLock.Parameters.AddWithValue("now", now);
            if (await cmdLock.ExecuteScalarAsync(cancellationToken) is not true)
            {
                return false;
            }
        }

        await using var cmdRevoke = new NpgsqlCommand(
            "UPDATE refresh_tokens SET revoked_at = @now WHERE id = @id",
            conn,
            transaction);
        cmdRevoke.Parameters.AddWithValue("now", now);
        cmdRevoke.Parameters.AddWithValue("id", successorId);
        await cmdRevoke.ExecuteNonQueryAsync(cancellationToken);
        return true;
    }

    private async Task<(long Id, string Token)> InsertRefreshTokenAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid userId, Guid familyId, CancellationToken cancellationToken)
    {
        byte[] refreshTokenBytes = RandomNumberGenerator.GetBytes(32);
        var now = timeProvider.GetUtcNow();

        await using var cmd = new NpgsqlCommand(
            "INSERT INTO " +
            "refresh_tokens (user_id, family_id, token_hash, created_at, expires_at) " +
            "VALUES (@userId, @familyId, @tokenHash, @createdAt, @expiresAt) RETURNING id",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("userId", userId);
        cmd.Parameters.AddWithValue("familyId", familyId);
        cmd.Parameters.AddWithValue("tokenHash", SHA256.HashData(refreshTokenBytes));
        cmd.Parameters.AddWithValue("createdAt", now.ToUnixTimeSeconds());
        cmd.Parameters.AddWithValue("expiresAt", (now + RefreshTokenLifetime).ToUnixTimeSeconds());
        var id = (long)(await cmd.ExecuteScalarAsync(cancellationToken))!;

        return (id, WebEncoders.Base64UrlEncode(refreshTokenBytes));
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
