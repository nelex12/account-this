using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// GET /api/companies/my — любая роль. Компания берётся только из JWT (company_id), параметров нет:
// чужую компанию запросить нечем.
[Collection("Api")]
public class CompaniesTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Owner)]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Worker)]
    public async Task My_ReturnsCompanyOfCaller(UserRole role)
    {
        var name = "Компания " + Guid.NewGuid();
        var companyId = await _db.CreateCompanyAsync(name);

        var response = await GetMy(TestTokens.Create(role, companyId: companyId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(companyId, body.RootElement.GetProperty("id").GetGuid());
        Assert.Equal(name, body.RootElement.GetProperty("name").GetString());
    }

    // Компания, созданная регистрацией Owner, видна ему с JWT от входа
    [Fact]
    public async Task My_AfterOwnerRegistration_ReturnsCreatedCompany()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone, companyName: "ООО Ромашка").EnsureCreated();
        var owner = (await _db.FindUserAsync(phone))!;

        var response = await GetMy(TestTokens.Create(UserRole.Owner, owner.Id, owner.CompanyId));

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(owner.CompanyId, body.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("ООО Ромашка", body.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task My_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/companies/my");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private Task<HttpResponseMessage> GetMy(string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/companies/my");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return _client.SendAsync(request);
    }
}
