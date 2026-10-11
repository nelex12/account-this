using System.Net;
using System.Net.Http.Json;
using AccountThis.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

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

    // ---------- Refresh token в cookie ----------
    // Клиент для этих тестов создаётся с HandleCookies = false (CookieClient): cookie передаются вручную,
    // иначе HttpClient подставлял бы их сам и сохранял между запросами, а Secure-cookie по http не отправлял бы вовсе.

    public const string RefreshCookieName = "refresh_token";

    public static HttpClient CookieClient(this ApiFactory factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    // refreshToken = null — запрос без cookie
    public static Task<HttpResponseMessage> RefreshAsync(this HttpClient client, string? refreshToken) =>
        client.SendAsync(WithRefreshCookie(HttpMethod.Post, "/api/auth/refresh", refreshToken));

    public static Task<HttpResponseMessage> LogoutAsync(this HttpClient client, string? refreshToken) =>
        client.SendAsync(WithRefreshCookie(HttpMethod.Post, "/api/auth/logout", refreshToken));

    // Set-Cookie для refresh_token из ответа; null — ответ cookie не выставляет
    public static SetCookieHeaderValue? RefreshSetCookie(this HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var values))
        {
            return null;
        }

        return SetCookieHeaderValue.ParseList(values.ToList())
            .SingleOrDefault(c => c.Name.Value == RefreshCookieName);
    }

    // Значение выставленного refresh token; тест падает, если cookie нет или это удаление
    public static string RefreshToken(this HttpResponseMessage response)
    {
        var cookie = response.RefreshSetCookie();
        Assert.True(cookie is not null, $"Ответ {(int)response.StatusCode} не выставил cookie {RefreshCookieName}");
        Assert.False(StringSegment.IsNullOrEmpty(cookie.Value), $"Cookie {RefreshCookieName} выставлена пустой");
        return cookie.Value.Value!;
    }

    // Удаление cookie по api.yaml (ClearRefreshCookie): пустое значение, тот же Path, срок истёк
    public static void AssertRefreshCookieCleared(this HttpResponseMessage response)
    {
        var cookie = response.RefreshSetCookie();
        Assert.True(cookie is not null, $"Ответ {(int)response.StatusCode} не удалил cookie {RefreshCookieName}");
        Assert.True(StringSegment.IsNullOrEmpty(cookie.Value), "Cookie при удалении должна быть пустой");
        Assert.Equal("/api/auth", cookie.Path.Value);
        Assert.True(
            cookie.MaxAge <= TimeSpan.Zero || cookie.Expires < DateTimeOffset.UtcNow,
            "У удаляемой cookie срок должен истечь: Max-Age=0 или Expires в прошлом");
    }

    // Вход, который должен пройти; возвращает refresh token из cookie
    public static async Task<string> LoginForRefreshTokenAsync(this HttpClient client, string phone)
    {
        var response = await client.LoginAsync(phone);
        Assert.True(
            response.StatusCode == HttpStatusCode.OK,
            $"Подготовка теста: вход вернул {(int)response.StatusCode}, ожидалось 200");
        return response.RefreshToken();
    }

    private static HttpRequestMessage WithRefreshCookie(HttpMethod method, string url, string? refreshToken)
    {
        var request = new HttpRequestMessage(method, url);
        if (refreshToken is not null)
        {
            request.Headers.Add("Cookie", $"{RefreshCookieName}={refreshToken}");
        }

        return request;
    }

    // Регистрация как подготовка теста: если она не прошла, тест падает здесь, с понятной причиной
    public static async Task EnsureCreated(this Task<HttpResponseMessage> registration)
    {
        var response = await registration;
        Assert.True(
            response.StatusCode == HttpStatusCode.Created,
            $"Подготовка теста: регистрация вернула {(int)response.StatusCode}, ожидалось 201");
    }
}
