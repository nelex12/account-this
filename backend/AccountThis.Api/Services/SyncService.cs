using AccountThis.Api.Events;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Shared.Events;
using Npgsql;

namespace AccountThis.Api.Services;

public sealed record SyncOutcome(IReadOnlyList<SyncResult> Results, IReadOnlyDictionary<int, string> FormatErrors)
{
    public bool IsRejected => FormatErrors.Count > 0;

    public static SyncOutcome Rejected(IReadOnlyDictionary<int, string> formatErrors) => new([], formatErrors);

    public static SyncOutcome Saved(IReadOnlyList<SyncResult> results) => new(results, new Dictionary<int, string>());
}

public interface ISyncService
{
    // companyId и issuerId — из JWT вызывающего завхоза
    Task<SyncOutcome> SyncAsync(Guid companyId, Guid issuerId, IReadOnlyList<SyncRecord?> records, CancellationToken cancellationToken);

    Task<List<RentalLogEntry>> GetLogsAsync(Guid companyId, RentalAction? action, Guid? toolId, CancellationToken cancellationToken);
}

public class SyncService(
    NpgsqlDataSource dataSource,
    ISignatureService signatureService,
    IEventOutbox eventOutbox,
    TimeProvider timeProvider) : ISyncService
{
    // TIME_DRIFT: |timestamp − scannedAt| больше этого значения
    private static readonly TimeSpan MaxScanDrift = TimeSpan.FromSeconds(60);

    private static readonly TimeSpan MaxFutureSkew = TimeSpan.FromMinutes(5);

    private sealed record WorkerRow(Guid Id, long? DeactivatedAt);

    private sealed record Verdict(ValidationFlag Flag, Guid? WorkerId, Guid? ToolId);

    public async Task<SyncOutcome> SyncAsync(Guid companyId, Guid issuerId, IReadOnlyList<SyncRecord?> records, CancellationToken cancellationToken)
    {
        var payloads = new QrPayload[records.Count];
        var formatErrors = new Dictionary<int, string>();
        for (var i = 0; i < records.Count; i++)
        {
            var record = records[i];
            if (record?.Qr is null || record.ScannedAt is null)
            {
                formatErrors[i] = "Запись должна содержать qr и scannedAt";
            }
            else if (QrPayloadParser.TryParse(record.Qr, out var payload, out var error))
            {
                payloads[i] = payload;
            }
            else
            {
                formatErrors[i] = error;
            }
        }

        if (formatErrors.Count > 0)
        {
            return SyncOutcome.Rejected(formatErrors);
        }

        if (records.Count == 0)
        {
            return SyncOutcome.Saved([]);
        }

        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();

        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

        var workers = await LoadWorkersAsync(conn, transaction, companyId, payloads.Select(p => p.TokenData.WorkerId), cancellationToken);
        var tools = await LoadToolsAsync(conn, transaction, companyId, payloads.Select(p => p.Operation.ToolId), cancellationToken);

        var results = new List<SyncResult>(records.Count);
        var createdFlags = new Dictionary<string, int>();
        for (var i = 0; i < records.Count; i++)
        {
            var qr = records[i]!.Qr!;
            var scannedAt = records[i]!.ScannedAt!.Value;
            var payload = payloads[i];

            var existing = await FindResendAsync(conn, transaction, issuerId, scannedAt, qr, cancellationToken);
            if (existing is not null)
            {
                results.Add(existing);
                continue;
            }

            var verdict = Verify(payload, scannedAt, now, workers, tools);
            var flag = verdict.Flag;
            if (flag == ValidationFlag.VALID
                && await ValidRecordExistsAsync(conn, transaction, payload.WorkerSignature, cancellationToken))
            {
                flag = ValidationFlag.DUPLICATE;
            }

            var logId = await TryInsertAsync(conn, transaction, companyId, issuerId, verdict, flag, payload, qr, scannedAt, now, cancellationToken);
            if (logId is null)
            {
                existing = await FindResendAsync(conn, transaction, issuerId, scannedAt, qr, cancellationToken);
                if (existing is not null)
                {
                    results.Add(existing);
                    continue;
                }

                flag = ValidationFlag.DUPLICATE;
                logId = await TryInsertAsync(conn, transaction, companyId, issuerId, verdict, flag, payload, qr, scannedAt, now, cancellationToken)
                    ?? throw new InvalidOperationException("Запись журнала не сохранена: конфликт уникальности после пометки DUPLICATE");
            }

            if (flag == ValidationFlag.VALID)
            {
                await UpdateToolConditionAsync(conn, transaction, companyId, payload.Operation, cancellationToken);
            }

            results.Add(new SyncResult { LogId = logId.Value, ValidationFlag = flag });
            createdFlags[flag.ToString()] = createdFlags.GetValueOrDefault(flag.ToString()) + 1;
        }

        if (createdFlags.Count > 0)
        {
            await eventOutbox.AddAsync(conn, transaction, EventTypes.RentalSynced, companyId, issuerId, new
            {
                total = records.Count,
                created = createdFlags.Values.Sum(),
                flags = createdFlags,
            }, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        return SyncOutcome.Saved(results);
    }

    // Первый сбой определяет флаг.
    private Verdict Verify(QrPayload payload, long scannedAt, long now,
        IReadOnlyDictionary<Guid, WorkerRow> workers, IReadOnlySet<Guid> tools)
    {
        var token = payload.TokenData;
        var operation = payload.Operation;

        var serverSignatureValid = signatureService.Verify(
            signatureService.ServerPublicKey, QrFormat.TokenSignedData(payload.Token), payload.ServerSignature);
        var workerSignatureValid = signatureService.Verify(
            token.WorkerPublicKey,
            QrFormat.OperationSignedData(payload.Token, payload.ServerSignature, payload.Op),
            payload.WorkerSignature);

        var worker = serverSignatureValid ? workers.GetValueOrDefault(token.WorkerId) : null;
        var toolFound = serverSignatureValid && workerSignatureValid && tools.Contains(operation.ToolId);
        var timestamp = operation.Timestamp;

        var flag =
            !serverSignatureValid ? ValidationFlag.INVALID_SERVER_SIG
            : !workerSignatureValid ? ValidationFlag.INVALID_WORKER_SIG
            : timestamp < token.IssuedAt || timestamp > token.ExpiresAt ? ValidationFlag.EXPIRED_TOKEN
            : IsTimeDrift(timestamp, scannedAt, now) ? ValidationFlag.TIME_DRIFT
            : worker is null ? ValidationFlag.UNKNOWN_WORKER
            : worker.DeactivatedAt is { } deactivatedAt && timestamp >= deactivatedAt ? ValidationFlag.WORKER_DEACTIVATED
            : !toolFound ? ValidationFlag.UNKNOWN_TOOL
            : ValidationFlag.VALID;

        return new Verdict(flag, worker?.Id, toolFound ? operation.ToolId : null);
    }

    private static bool IsTimeDrift(long timestamp, long scannedAt, long now)
    {
        var maxFuture = now + (long)MaxFutureSkew.TotalSeconds;
        return Math.Abs((decimal)timestamp - scannedAt) > (decimal)MaxScanDrift.TotalSeconds
            || timestamp > maxFuture
            || scannedAt > maxFuture;
    }

    private static async Task<Dictionary<Guid, WorkerRow>> LoadWorkersAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid companyId, IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT id, deactivated_at FROM users WHERE company_id = @companyId AND id = ANY(@ids)",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("ids", ids.Distinct().ToArray());

        var workers = new Dictionary<Guid, WorkerRow>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0);
            workers[id] = new WorkerRow(id, reader.IsDBNull(1) ? null : reader.GetInt64(1));
        }

        return workers;
    }

    private static async Task<HashSet<Guid>> LoadToolsAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid companyId, IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM tools WHERE company_id = @companyId AND id = ANY(@ids)",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("ids", ids.Distinct().ToArray());

        var tools = new HashSet<Guid>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            tools.Add(reader.GetGuid(0));
        }

        return tools;
    }

    private static async Task<SyncResult?> FindResendAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid issuerId, long scannedAt, string qr, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT id, validation_flag::text FROM rental_logs " +
            "WHERE issuer_id = @issuerId AND scanned_at = @scannedAt AND md5(signed_payload) = md5(@qr) AND signed_payload = @qr",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("issuerId", issuerId);
        cmd.Parameters.AddWithValue("scannedAt", scannedAt);
        cmd.Parameters.AddWithValue("qr", qr);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new SyncResult { LogId = reader.GetInt32(0), ValidationFlag = Enum.Parse<ValidationFlag>(reader.GetString(1)) };
    }

    private static async Task<bool> ValidRecordExistsAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, string workerSignature, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT EXISTS (SELECT 1 FROM rental_logs WHERE worker_signature = @signature AND validation_flag = 'VALID')",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("signature", workerSignature);
        return (bool)(await cmd.ExecuteScalarAsync(cancellationToken))!;
    }

    private static async Task<int?> TryInsertAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid companyId, Guid issuerId, Verdict verdict, ValidationFlag flag,
        QrPayload payload, string qr, long scannedAt, long now, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO rental_logs (company_id, issuer_id, tool_id, worker_id, action, tool_condition, qr_timestamp, " +
            "worker_signature, signed_payload, scanned_at, validation_flag, created_at) " +
            "VALUES (@companyId, @issuerId, @toolId, @workerId, @action::rental_action, @condition::tool_condition, @qrTimestamp, " +
            "@workerSignature, @qr, @scannedAt, @flag::validation_flag, @now) " +
            "ON CONFLICT DO NOTHING RETURNING id",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("issuerId", issuerId);
        cmd.Parameters.Add(new NpgsqlParameter<Guid?>("toolId", NpgsqlTypes.NpgsqlDbType.Uuid) { TypedValue = verdict.ToolId });
        cmd.Parameters.Add(new NpgsqlParameter<Guid?>("workerId", NpgsqlTypes.NpgsqlDbType.Uuid) { TypedValue = verdict.WorkerId });
        cmd.Parameters.AddWithValue("action", payload.Operation.Action.ToString());
        cmd.Parameters.AddWithValue("condition", payload.Operation.ToolCondition.ToString());
        cmd.Parameters.AddWithValue("qrTimestamp", payload.Operation.Timestamp);
        cmd.Parameters.AddWithValue("workerSignature", payload.WorkerSignature);
        cmd.Parameters.AddWithValue("qr", qr);
        cmd.Parameters.AddWithValue("scannedAt", scannedAt);
        cmd.Parameters.AddWithValue("flag", flag.ToString());
        cmd.Parameters.AddWithValue("now", now);

        return (int?)await cmd.ExecuteScalarAsync(cancellationToken);
    }

    private static async Task UpdateToolConditionAsync(
        NpgsqlConnection conn, NpgsqlTransaction transaction, Guid companyId, RentalOperation operation, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(
            "UPDATE tools SET condition = @condition::tool_condition, condition_updated_at = @timestamp " +
            "WHERE id = @toolId AND company_id = @companyId AND condition_updated_at <= @timestamp",
            conn,
            transaction);
        cmd.Parameters.AddWithValue("condition", operation.ToolCondition.ToString());
        cmd.Parameters.AddWithValue("timestamp", operation.Timestamp);
        cmd.Parameters.AddWithValue("toolId", operation.ToolId);
        cmd.Parameters.AddWithValue("companyId", companyId);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<List<RentalLogEntry>> GetLogsAsync(Guid companyId, RentalAction? action, Guid? toolId, CancellationToken cancellationToken)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var cmd = new NpgsqlCommand { Connection = conn };

        var sql =
            "SELECT r.id, r.tool_id, t.name, r.worker_id, u.full_name, r.issuer_id, r.action::text, r.tool_condition::text, " +
            "r.qr_timestamp, r.scanned_at, r.validation_flag::text, r.created_at, r.signed_payload " +
            "FROM rental_logs r " +
            "LEFT JOIN tools t ON t.id = r.tool_id " +
            "LEFT JOIN users u ON u.id = r.worker_id " +
            "WHERE r.company_id = @companyId";
        cmd.Parameters.AddWithValue("companyId", companyId);

        if (action is not null)
        {
            sql += " AND r.action = @action::rental_action";
            cmd.Parameters.AddWithValue("action", action.Value.ToString());
        }

        if (toolId is not null)
        {
            sql += " AND r.tool_id = @toolId";
            cmd.Parameters.AddWithValue("toolId", toolId.Value);
        }

        cmd.CommandText = sql + " ORDER BY r.qr_timestamp DESC, r.id DESC";

        var entries = new List<RentalLogEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var toolName = reader.IsDBNull(2) ? null : reader.GetString(2);
            var workerName = reader.IsDBNull(4) ? null : reader.GetString(4);
            if (toolName is null || workerName is null)
            {
                QrPayloadParser.TryParse(reader.GetString(12), out var payload, out _);
                toolName ??= payload?.Operation.ToolName ?? string.Empty;
                workerName ??= payload?.TokenData.Fio ?? string.Empty;
            }

            entries.Add(new RentalLogEntry
            {
                Id = reader.GetInt32(0),
                ToolId = reader.IsDBNull(1) ? null : reader.GetGuid(1),
                ToolName = toolName,
                WorkerId = reader.IsDBNull(3) ? null : reader.GetGuid(3),
                WorkerName = workerName,
                IssuerId = reader.GetGuid(5),
                Action = Enum.Parse<RentalAction>(reader.GetString(6)),
                ToolCondition = Enum.Parse<ToolCondition>(reader.GetString(7)),
                QrTimestamp = reader.GetInt64(8),
                ScannedAt = reader.GetInt64(9),
                ValidationFlag = Enum.Parse<ValidationFlag>(reader.GetString(10)),
                CreatedAt = reader.GetInt64(11),
            });
        }

        return entries;
    }
}
