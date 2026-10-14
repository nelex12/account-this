using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// GET /api/users/me — любая роль. Пользователь берётся только из JWT (sub + company_id), параметров нет:
// чужой профиль запросить нечем, а sub из чужой компании неотличим от несуществующего (404).
[Collection("Api")]
public class MeTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Owner)]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Worker)]
    public async Task Me_ReturnsOwnProfile(UserRole role)
    {
        var user = await CreateUser(role, fullName: "Петров Пётр Петрович");

        var response = await GetMe(TestTokens.Create(role, user.Id, user.CompanyId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var me = body.RootElement;
        Assert.Equal(user.Id, me.GetProperty("id").GetGuid());
        Assert.Equal("Петров Пётр Петрович", me.GetProperty("fullName").GetString());
        Assert.Equal(user.Phone, me.GetProperty("phone").GetString());
        Assert.Equal(role.ToString(), me.GetProperty("role").GetString());
        // Owner подтверждён сразу, Worker и Issuer — после approve
        Assert.Equal(role == UserRole.Owner, me.GetProperty("isApproved").GetBoolean());
        Assert.True(me.GetProperty("isActive").GetBoolean());
    }

    // В ответе нет хеша пароля и других внутренних полей
    [Fact]
    public async Task Me_ReturnsOnlyContractFields()
    {
        var owner = await CreateUser(UserRole.Owner);

        var response = await GetMe(TestTokens.Create(UserRole.Owner, owner.Id, owner.CompanyId));

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var fields = body.RootElement.EnumerateObject().Select(p => p.Name).Order();
        Assert.Equal(new[] { "fullName", "id", "isActive", "isApproved", "phone", "role" }, fields);
    }

    // Пока access token не истёк, уволенный видит свой профиль с isActive = false
    [Fact]
    public async Task Me_FiredUser_ReturnsIsActiveFalse()
    {
        var worker = await CreateUser(UserRole.Worker);
        await _db.SetUserFlagsAsync(worker.Id, isApproved: true, isActive: false);

        var response = await GetMe(TestTokens.Create(UserRole.Worker, worker.Id, worker.CompanyId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(body.RootElement.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Me_UnknownUser_Returns404()
    {
        var companyId = await _db.CreateCompanyAsync();

        var response = await GetMe(TestTokens.Create(UserRole.Worker, Guid.NewGuid(), companyId));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // sub существующего пользователя, но company_id другой компании — 404, а не его профиль
    [Fact]
    public async Task Me_UserOfOtherCompany_Returns404()
    {
        var owner = await CreateUser(UserRole.Owner);
        var otherCompanyId = await _db.CreateCompanyAsync();

        var response = await GetMe(TestTokens.Create(UserRole.Owner, owner.Id, otherCompanyId));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Остальные /api/users по-прежнему только для Owner
    [Theory]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Worker)]
    public async Task GetUsers_NotOwner_StillReturns403(UserRole role)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.Create(role));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<UserRow> CreateUser(UserRole role, string fullName = "Иванов Иван Иванович")
    {
        var phone = TestDb.UniquePhone();
        if (role == UserRole.Owner)
        {
            await _client.RegisterOwnerAsync(phone, fullName: fullName).EnsureCreated();
        }
        else
        {
            var owner = await CreateUser(UserRole.Owner);
            await _client.RegisterEmployeeAsync(role, owner.CompanyId, phone, fullName).EnsureCreated();
        }

        return (await _db.FindUserAsync(phone))!;
    }

    private Task<HttpResponseMessage> GetMe(string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/users/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return _client.SendAsync(request);
    }
}
