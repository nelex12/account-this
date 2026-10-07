using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// Телефон — российский номер. На входе допускаются префиксы +7, 7 или 8, затем ровно 10 цифр (только 0–9),
// между ними — пробелы, скобки и дефисы. Сервер нормализует номер к виду +7XXXXXXXXXX (оставляет цифры,
// первую заменяет на +7) и дальше работает только с ним: хранение, уникальность, вход, ответы API.
public static class PhoneFormat
{
    public const string InputPattern = @"^[\s()-]*(\+7|7|8)(?:[\s()-]*[0-9]){10}[\s()-]*$";

    public const string ErrorMessage = "Телефон должен быть российским номером: +7XXXXXXXXXX, 8XXXXXXXXXX или 7XXXXXXXXXX";

    // Вход уже проверен по InputPattern: ровно 11 цифр, первая — 7 или 8
    public static string Normalize(string phone)
    {
        var digits = new string(phone.Where(char.IsAsciiDigit).ToArray());
        return "+7" + digits[1..];
    }
}

// components.schemas.RegisterRequest
// Компания задаётся по роли: Owner создаёт новую (CompanyName), Worker и Issuer присоединяются к существующей (CompanyId).
// Списка компаний нет: Owner сообщает сотрудникам и завхозам id своей компании (GET /api/companies/my).
public class RegisterRequest : IValidatableObject
{
    // Не длиннее 100 символов: ФИО попадает в QR сотрудника (fio в token)
    [Required]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    // Любой допустимый формат (см. PhoneFormat), сохраняется нормализованным
    [Required]
    [RegularExpression(PhoneFormat.InputPattern, ErrorMessage = PhoneFormat.ErrorMessage)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    // Nullable, чтобы [Required] срабатывал: у ненулевого enum пропуск молча превратился бы в Worker.
    [Required]
    public UserRole? Role { get; set; }

    // Только Worker и Issuer (обязателен): id существующей компании, который сообщил её Owner
    public Guid? CompanyId { get; set; }

    // Только Owner (обязателен): название новой компании, не длиннее 100 символов. Не уникально.
    // Owner становится первым пользователем компании и подтверждается сразу.
    [MaxLength(100)]
    public string? CompanyName { get; set; }

    // Взаимосвязь полей зависит от роли. Если Role не передана, это ошибка [Required] — здесь не дублируется.
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        switch (Role)
        {
            case UserRole.Owner:
                if (string.IsNullOrWhiteSpace(CompanyName))
                {
                    yield return new ValidationResult("Владелец при регистрации указывает название новой компании", [nameof(CompanyName)]);
                }

                if (CompanyId is not null)
                {
                    yield return new ValidationResult("Владелец создаёт новую компанию, companyId не передаётся", [nameof(CompanyId)]);
                }

                break;

            case UserRole.Worker or UserRole.Issuer:
                if (CompanyId is null || CompanyId == Guid.Empty)
                {
                    yield return new ValidationResult("Укажите id компании, к которой вы присоединяетесь", [nameof(CompanyId)]);
                }

                if (CompanyName is not null)
                {
                    yield return new ValidationResult("Новую компанию создаёт только владелец, companyName не передаётся", [nameof(CompanyName)]);
                }

                break;
        }
    }
}

// components.schemas.LoginRequest
public class LoginRequest
{
    // Любой допустимый формат (см. PhoneFormat), перед поиском нормализуется
    [Required]
    [RegularExpression(PhoneFormat.InputPattern, ErrorMessage = PhoneFormat.ErrorMessage)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

// components.schemas.LoginResponse
public class LoginResponse
{
    // JWT, срок действия 12 часов
    public string AccessToken { get; set; } = string.Empty;
}

// components.schemas.ServerKeyResponse
public class ServerKeyResponse
{
    // Публичный ключ Ed25519, 32 байта, base64url без паддинга
    public string ServerPublicKey { get; set; } = string.Empty;

    // Unix time сервера — для вычисления смещения часов клиента
    public long ServerTime { get; set; }
}

// components.schemas.ServerSignedToken
// Содержимое token из WorkerCertificate (base64url → UTF-8 JSON). Сервер удостоверяет подписью,
// что WorkerPublicKey принадлежит сотруднику WorkerId до момента ExpiresAt.
// Сама подпись передаётся отдельно (WorkerCertificate.ServerSignature) и ставится над строкой token.
public class ServerSignedToken
{
    // UUID пользователя в каноническом виде (строчные hex, 8-4-4-4-12)
    public Guid WorkerId { get; set; }

    public string Fio { get; set; } = string.Empty;

    // Unix time выдачи сертификата
    public long IssuedAt { get; set; }

    // Unix time истечения срока действия (IssuedAt + 12 часов)
    public long ExpiresAt { get; set; }

    // Временный публичный ключ Ed25519 сотрудника, base64url
    public string WorkerPublicKey { get; set; } = string.Empty;
}

// components.schemas.WorkerCertificate
// Сертификат = Token + ServerSignature. Клиент хранит и использует обе строки в точности как получены.
public class WorkerCertificate
{
    // base64url(UTF-8 JSON ServerSignedToken)
    public string Token { get; set; } = string.Empty;

    // base64url(Ed25519(ключ сервера, ASCII "AT1-TOKEN." + Token))
    public string ServerSignature { get; set; } = string.Empty;

    // Временный приватный ключ Ed25519 (32-байтный seed), base64url
    public string TemporaryPrivateKey { get; set; } = string.Empty;

    // Unix time сервера — для вычисления смещения часов клиента
    public long ServerTime { get; set; }
}
