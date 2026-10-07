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
    // companyId и issuerId — из JWT вызывающего завхоза
    Task<SyncOutcome> SyncAsync(Guid companyId, Guid issuerId, IReadOnlyList<SyncRecord> records, CancellationToken cancellationToken);

    // Журнал компании: rental_logs WHERE company_id = companyId.
    // Новые сверху: qr_timestamp DESC, id DESC. toolId-фильтр не возвращает записи с tool_id = NULL
    Task<List<RentalLogEntry>> GetLogsAsync(Guid companyId, RentalAction? action, Guid? toolId, CancellationToken cancellationToken);
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

    public Task<SyncOutcome> SyncAsync(Guid companyId, Guid issuerId, IReadOnlyList<SyncRecord> records, CancellationToken cancellationToken)
    {
        // 1. Разобрать все строки QrPayloadParser; хоть одна не по формату — SyncOutcome.Rejected.
        // 2. Для каждой записи — флаг по первой непройденной проверке (порядок ValidationFlag).
        //    UNKNOWN_WORKER — workerId из токена нет в users с company_id = companyId.
        //    UNKNOWN_TOOL — toolId из операции нет в tools с company_id = companyId.
        //    Чужой неотличим от несуществующего. Запись сохраняется с company_id = companyId;
        //    worker_id / tool_id заполняются только проверенным и найденным в этой компании (иначе NULL —
        //    составные внешние ключи не пустят ссылку на чужую компанию).
        // 3. Сохранить в rental_logs; повторная отправка (uq_rental_logs_resend) — вернуть существующий id.
        //    Гонка за VALID по одной подписи (uq_rental_logs_valid_signature) — запись становится DUPLICATE.
        // 4. VALID — обновить tools.condition, если timestamp >= condition_updated_at (инструмент уже из компании завхоза).
        throw new NotImplementedException();
    }

    public Task<List<RentalLogEntry>> GetLogsAsync(Guid companyId, RentalAction? action, Guid? toolId, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}
