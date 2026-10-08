using System.Net;
using System.Net.Http.Json;
using AccountThis.Api.Models;

namespace AccountThis.Api.Tests.Infrastructure;

// Готовые запросы к /api/auth, чтобы тесты описывали проверяемое поведение, а не сборку тел запросов
public static class AuthRequests
{
    public const string Password = "Correct-Horse-1";

    public static Task<HttpResponseMessage> RegisterOwnerAsync(
        this HttpClient client, string phone, string companyName = "ООО Тест", string fullName = "Петров Пётр Петрович") =>
        client.PostAsJsonAsync("/api/auth/register", new
        {
            fullName,
            phone,
            password = Password,
            role = "Owner",
            companyName,
        });

    // Worker или Issuer, присоединяется к существующей компании
    public static Task<HttpResponseMessage> RegisterEmployeeAsync(
        this HttpClient client, UserRole role, Guid companyId, string phone, string fullName = "Иванов Иван Иванович") =>
        client.PostAsJsonAsync("/api/auth/register", new
        {
            fullName,
            phone,
            password = Password,
            role = role.ToString(),
            companyId,
        });

    public static Task<HttpResponseMessage> LoginAsync(this HttpClient client, string phone, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/login", new { phone, password });

    // Регистрация как подготовка теста: если она не прошла, тест падает здесь, с понятной причиной
    public static async Task EnsureCreated(this Task<HttpResponseMessage> registration)
    {
        var response = await registration;
        Assert.True(
            response.StatusCode == HttpStatusCode.Created,
            $"Подготовка теста: регистрация вернула {(int)response.StatusCode}, ожидалось 201");
    }
}
