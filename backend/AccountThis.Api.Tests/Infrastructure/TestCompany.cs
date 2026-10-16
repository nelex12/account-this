using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AccountThis.Api.Models;

namespace AccountThis.Api.Tests.Infrastructure;

public sealed record TestUser(Guid Id, Guid CompanyId, string Phone, string FullName, UserRole Role)
{
    // JWT собирается в тестах (TestTokens), чтобы тесты не зависели от реализации входа
    public string Jwt => TestTokens.Create(Role, Id, CompanyId);
}

// Подготовка компании: Owner регистрируется через API, сотрудники — через API и подтверждаются напрямую в БД
public static class TestCompany
{
    public static async Task<TestUser> CreateOwnerAsync(this ApiFactory factory, HttpClient client, string fullName = "Петров Пётр Петрович")
    {
        var phone = TestDb.UniquePhone();
        await client.RegisterOwnerAsync(phone, fullName: fullName).EnsureCreated();
        var row = (await factory.Db.FindUserAsync(phone))!;
        return new TestUser(row.Id, row.CompanyId, phone, fullName, UserRole.Owner);
    }

    public static async Task<TestUser> CreateEmployeeAsync(
        this ApiFactory factory, HttpClient client, TestUser owner, UserRole role,
        string fullName = "Иванов Иван Иванович", bool isApproved = true)
    {
        var phone = TestDb.UniquePhone();
        await client.RegisterEmployeeAsync(role, owner.CompanyId, phone, fullName).EnsureCreated();
        var row = (await factory.Db.FindUserAsync(phone))!;
        if (isApproved)
        {
            await factory.Db.SetUserFlagsAsync(row.Id, isApproved: true, isActive: true);
        }

        return new TestUser(row.Id, row.CompanyId, phone, fullName, role);
    }

    public static Task<HttpResponseMessage> SendAs(
        this HttpClient client, TestUser user, HttpMethod method, string url, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user.Jwt);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return client.SendAsync(request);
    }

    // Инструмент через API; возвращает его id
    public static async Task<Guid> CreateToolAsync(this HttpClient client, TestUser user, string name = "Дрель Bosch GSB 16 RE")
    {
        var response = await client.SendAs(user, HttpMethod.Post, "/api/tools", new { name });
        Assert.True(response.IsSuccessStatusCode, $"Подготовка теста: создание инструмента вернуло {(int)response.StatusCode}");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("id").GetGuid();
    }

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }
}
