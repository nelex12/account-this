using System.Diagnostics.CodeAnalysis;
using AccountThis.Api.Models;

namespace AccountThis.Api.Services;

// Протокол QR сотрудника: "AT1.<token>.<serverSignature>.<op>.<workerSignature>" (OfflineRentalPayload в api.yaml)
public static class QrFormat
{
    public const string Version = "AT1";

    // Подпись сервера ставится над TokenSignaturePrefix + token
    public const string TokenSignaturePrefix = "AT1-TOKEN.";

    // Подпись сотрудника ставится над OperationSignaturePrefix + token + "." + serverSignature + "." + op
    public const string OperationSignaturePrefix = "AT1-OP.";

    public static readonly TimeSpan CertificateLifetime = TimeSpan.FromHours(12);
}

// Разобранная строка QR. Исходные строки частей сохраняются: подписи проверяются над ними в том виде,
// в каком они пришли, JSON заново не сериализуется.
public sealed record QrPayload(
    string Token,
    string ServerSignature,
    string Op,
    string WorkerSignature,
    ServerSignedToken TokenData,
    RentalOperation Operation);

public static class QrPayloadParser
{
    // Строгий разбор по правилам OfflineRentalPayload. error — текст для ValidationProblemDetails,
    // например "Строка не соответствует формату AT1: ожидается 5 частей через точку".
    public static bool TryParse(
        string qr,
        [NotNullWhen(true)] out QrPayload? payload,
        [NotNullWhen(false)] out string? error)
    {
        throw new NotImplementedException();
    }
}
