using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// components.schemas.RegisterRequest
public class RegisterRequest
{
    [Required]
    public string FullName { get; set; } = string.Empty;

    [Required]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public UserRole Role { get; set; }
}

// components.schemas.LoginRequest
public class LoginRequest
{
    [Required]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

// components.schemas.LoginResponse
public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
}

// components.schemas.ServerKeyResponse
public class ServerKeyResponse
{
    public string ServerPublicKey { get; set; } = string.Empty;
}

// components.schemas.ServerSignedToken
// Токен, которым сервер подтверждает личность и временные полномочия сотрудника.
// Не непрозрачный блоб: бэкенд завхоза читает WorkerPublicKey/ExpiresAt для оффлайн-верификации.
public class ServerSignedToken
{
    public int WorkerId { get; set; }

    public string Fio { get; set; } = string.Empty;

    // Unix time выдачи токена
    public int IssuedAt { get; set; }

    // Unix time истечения срока действия токена
    public int ExpiresAt { get; set; }

    public string WorkerPublicKey { get; set; } = string.Empty;

    public string ServerSignature { get; set; } = string.Empty;
}

// components.schemas.WorkerCertificate
public class WorkerCertificate
{
    public string TemporaryPrivateKey { get; set; } = string.Empty;

    public ServerSignedToken ServerSignedToken { get; set; } = new();
}