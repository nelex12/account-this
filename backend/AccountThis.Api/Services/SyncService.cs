using AccountThis.Api.Models;
using AccountThis.Api.Security;
using Npgsql;

namespace AccountThis.Api.Services;

// Либо запрос отклонён целиком (FormatErrors: номер записи → причина, ничего не сохранено),
// либо все записи сохранены (Results — в порядке запроса)
public sealed record SyncOutcome(IReadOnlyList<SyncResult> Results, IReadOnlyDictionary<int, string> FormatErrors)
{
    public bool IsRejected => FormatErrors.Count > 0;

    public static SyncOutcome Rejected(IReadOnlyDictionary<int, string> formatErrors) => new([], formatErrors);

    public static SyncOutcome Saved(IReadOnlyList<SyncResult> results) => new(results, new Dictionary<int, string>());
}

public interface ISyncService
{
    // issuerId — из JWT вызывающего завхоза
    Task<SyncOutcome> SyncAsync(int issuerId, IReadOnlyList<SyncRecord> records, CancellationToken cancellationToken);

    // Новые сверху: qr_timestamp DESC, id DESC. toolId-фильтр не возвращает записи с tool_id = NULL
    Task<List<RentalLogEntry>> GetLogsAsync(RentalAction? action, int? toolId, CancellationToken cancellationToken);
}

public class SyncService(
    NpgsqlDataSource dataSource,
    ISignatureService signatureService,
    TimeProvider timeProvider) : ISyncService
{
    // TIME_DRIFT: |timestamp − scannedAt| больше этого значения
    private static readonly TimeSpan MaxScanDrift = TimeSpan.FromSeconds(60);

    // TIME_DRIFT: timestamp или scannedAt позже момента приёма сервером больше чем на это значение
    private static readonly TimeSpan MaxFutureSkew = TimeSpan.FromMinutes(5);

    public Task<SyncOutcome> SyncAsync(int issuerId, IReadOnlyList<SyncRecord> records, CancellationToken cancellationToken)
    {
        // 1. Разобрать все строки QrPayloadParser; хоть одна не по формату — SyncOutcome.Rejected.
        // 2. Для каждой записи — флаг по первой непройденной проверке (порядок ValidationFlag).
        // 3. Сохранить в rental_logs; повторная отправка (uq_rental_logs_resend) — вернуть существующий id.
        //    Гонка за VALID по одной подписи (uq_rental_logs_valid_signature) — запись становится DUPLICATE.
        // 4. VALID — обновить tools.condition, если timestamp >= condition_updated_at.
        throw new NotImplementedException();
    }

    public Task<List<RentalLogEntry>> GetLogsAsync(RentalAction? action, int? toolId, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
