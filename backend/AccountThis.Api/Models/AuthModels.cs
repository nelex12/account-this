using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

public static class PhoneFormat
{
    public const string InputPattern = @"^[\s()-]*(\+7|7|8)(?:[\s()-]*[0-9]){10}[\s()-]*$";

    public const string ErrorMessage = "Телефон должен быть российским номером: +7XXXXXXXXXX, 8XXXXXXXXXX или 7XXXXXXXXXX";

    public static string Normalize(string phone)
    {
        var digits = new string(phone.Where(char.IsAsciiDigit).ToArray());
        return "+7" + digits[1..];
    }
}

public class RegisterRequest : IValidatableObject
{
    [Required]
    [MaxLength(100)]
    [NoNullCharacter]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [RegularExpression(PhoneFormat.InputPattern, ErrorMessage = PhoneFormat.ErrorMessage)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public UserRole? Role { get; set; }

    public Guid? CompanyId { get; set; }

    [MaxLength(100)]
    [NoNullCharacter]
    public string? CompanyName { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        switch (Role)
        {
            case UserRole.Owner:
                if (string.IsNullOrWhiteSpace(CompanyName))
                {
                    yield return new ValidationResult("Владелец при регистрации указывает название новой компании", ["companyName"]);
                }

                if (CompanyId is not null)
                {
                    yield return new ValidationResult("Владелец создаёт новую компанию, companyId не передаётся", ["companyId"]);
                }

                break;

            case UserRole.Worker or UserRole.Issuer:
                if (CompanyId is null || CompanyId == Guid.Empty)
                {
                    yield return new ValidationResult("Укажите id компании, к которой вы присоединяетесь", ["companyId"]);
                }

                if (CompanyName is not null)
                {
                    yield return new ValidationResult("Новую компанию создаёт только владелец, companyName не передаётся", ["companyName"]);
                }

                break;
        }
    }
}

// components.schemas.LoginRequest
public class LoginRequest
{
    [Required]
    [RegularExpression(PhoneFormat.InputPattern, ErrorMessage = PhoneFormat.ErrorMessage)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordRequest : IValidatableObject
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (NewPassword == CurrentPassword)
        {
            yield return new ValidationResult("Новый пароль должен отличаться от текущего", ["newPassword"]);
        }
    }
}

// components.schemas.LoginResponse
public class LoginResponse

{
    // JWT, срок действия 15 минут
    public string AccessToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
}

// components.schemas.ServerKeyResponse
public class ServerKeyResponse
{
    // Публичный ключ Ed25519, 32 байта, base64url без паддинга
    public string ServerPublicKey { get; set; } = string.Empty;

    // Unix time сервера — для вычисления смещения часов клиента
    public long ServerTime { get; set; }
}

public class ServerSignedToken
{
    public Guid WorkerId { get; set; }

    public string Fio { get; set; } = string.Empty;

    // Unix time выдачи сертификата
    public long IssuedAt { get; set; }

    // Unix time истечения срока действия (IssuedAt + 12 часов)
    public long ExpiresAt { get; set; }

    // Временный публичный ключ Ed25519 сотрудника, base64url
    public string WorkerPublicKey { get; set; } = string.Empty;
}

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
