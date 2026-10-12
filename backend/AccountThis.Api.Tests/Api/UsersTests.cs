using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// GET /api/users и POST /api/users/{id}/approve (роль Owner). Owner работает только с пользователями своей компании
// (company_id из JWT): пользователь другой компании в списке не виден, а approve для него — 404 без изменений в БД.
// Owner вызывает API с JWT из TestTokens, чтобы тесты не зависели от входа Owner.
[Collection("Api")]
public class UsersTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Fact]
    public async Task GetUsers_ReturnsAllUsersOfOwnCompanyWithFields()
    {
        var owner = await CreateOwner();
        var pending = await CreateEmployee(owner, UserRole.Issuer, fullName: "Сидоров Сидор");
        var fired = await CreateEmployee(owner, UserRole.Worker);
        await _db.SetUserFlagsAsync(fired.Id, isApproved: true, isActive: false);

        var response = await Send(HttpMethod.Get, "/api/users", owner);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var users = await ReadUsers(response);
        Assert.Equal(
            new[] { owner.Id, pending.Id, fired.Id }.Order(),
            users.Select(u => u.GetProperty("id").GetGuid()).Order());

        var pendingJson = users.Single(u => u.GetProperty("id").GetGuid() == pending.Id);
        Assert.Equal("Сидоров Сидор", pendingJson.GetProperty("fullName").GetString());
        Assert.Equal(pending.Phone, pendingJson.GetProperty("phone").GetString());
        Assert.Equal("Issuer", pendingJson.GetProperty("role").GetString());
        Assert.False(pendingJson.GetProperty("isApproved").GetBoolean());
        Assert.True(pendingJson.GetProperty("isActive").GetBoolean());

        var firedJson = users.Single(u => u.GetProperty("id").GetGuid() == fired.Id);
        Assert.False(firedJson.GetProperty("isActive").GetBoolean());
    }

    // В ответе нет хеша пароля и других внутренних полей
    [Fact]
    public async Task GetUsers_ReturnsOnlyContractFields()
    {
        var owner = await CreateOwner();

        var users = await ReadUsers(await Send(HttpMethod.Get, "/api/users", owner));

        var fields = users.Single().EnumerateObject().Select(p => p.Name).Order();
        Assert.Equal(new[] { "fullName", "id", "isActive", "isApproved", "phone", "role" }, fields);
    }

    [Fact]
    public async Task GetUsers_DoesNotShowOtherCompanies()
    {
        var owner = await CreateOwner();
        var otherOwner = await CreateOwner();
        await CreateEmployee(otherOwner, UserRole.Worker);

        var users = await ReadUsers(await Send(HttpMethod.Get, "/api/users", owner));

        Assert.Equal(owner.Id, users.Single().GetProperty("id").GetGuid());
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task Approve_EmployeeCanLogIn(UserRole role)
    {
        var owner = await CreateOwner();
        var employee = await CreateEmployee(owner, role);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.LoginAsync(employee.Phone)).StatusCode);

        var response = await Approve(owner, employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
        Assert.True((await _db.FindUserAsync(employee.Phone))!.IsApproved);
        Assert.Equal(HttpStatusCode.OK, (await _client.LoginAsync(employee.Phone)).StatusCode);
    }

    [Fact]
    public async Task Approve_Repeated_Returns200()
    {
        var owner = await CreateOwner();
        var employee = await CreateEmployee(owner, UserRole.Worker);
        await Approve(owner, employee.Id);

        var response = await Approve(owner, employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // BOLA: id пользователя чужой компании известен, но подтвердить его нельзя — и он неотличим от несуществующего
    [Fact]
    public async Task Approve_UserOfAnotherCompany_Returns404AndDoesNotApprove()
    {
        var owner = await CreateOwner();
        var stranger = await CreateEmployee(await CreateOwner(), UserRole.Worker);

        var response = await Approve(owner, stranger.Id);

        await AssertNotFound(response);
        Assert.False((await _db.FindUserAsync(stranger.Phone))!.IsApproved);
    }

    [Fact]
    public async Task Approve_UnknownId_Returns404()
    {
        var owner = await CreateOwner();

        await AssertNotFound(await Approve(owner, Guid.NewGuid()));
    }

    [Fact]
    public async Task Approve_NotUuid_Returns400()
    {
        var owner = await CreateOwner();

        var response = await Send(HttpMethod.Post, "/api/users/not-a-uuid/approve", owner);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Подтверждает только Owner: Issuer своей же компании получает 403, пользователь не подтверждается
    [Fact]
    public async Task Approve_ByIssuer_Returns403()
    {
        var owner = await CreateOwner();
        var employee = await CreateEmployee(owner, UserRole.Worker);
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/users/{employee.Id}/approve");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestTokens.Create(UserRole.Issuer, Guid.NewGuid(), owner.CompanyId));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False((await _db.FindUserAsync(employee.Phone))!.IsApproved);
    }

    // Весь путь через API, как его пройдёт клиент: Owner регистрируется и входит, берёт id компании,
    // Worker и Issuer регистрируются по нему, Owner находит их в списке и подтверждает, все трое входят
    [Fact]
    public async Task FullFlow_OwnerApprovesEmployees_AllRolesLogIn()
    {
        var ownerPhone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(ownerPhone).EnsureCreated();
        var ownerToken = await LoginForAccessToken(ownerPhone);

        var company = await SendWithToken(HttpMethod.Get, "/api/companies/my", ownerToken);
        Assert.Equal(HttpStatusCode.OK, company.StatusCode);
        using var companyJson = JsonDocument.Parse(await company.Content.ReadAsStringAsync());
        var companyId = companyJson.RootElement.GetProperty("id").GetGuid();

        var workerPhone = TestDb.UniquePhone();
        var issuerPhone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(UserRole.Worker, companyId, workerPhone).EnsureCreated();
        await _client.RegisterEmployeeAsync(UserRole.Issuer, companyId, issuerPhone).EnsureCreated();

        var users = await ReadUsers(await SendWithToken(HttpMethod.Get, "/api/users", ownerToken));
        foreach (var pending in users.Where(u => !u.GetProperty("isApproved").GetBoolean()))
        {
            var approve = await SendWithToken(
                HttpMethod.Post, $"/api/users/{pending.GetProperty("id").GetGuid()}/approve", ownerToken);
            Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await _client.LoginAsync(workerPhone)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.LoginAsync(issuerPhone)).StatusCode);
    }

    private Task<HttpResponseMessage> Approve(UserRow owner, Guid userId) =>
        Send(HttpMethod.Post, $"/api/users/{userId}/approve", owner);

    private Task<HttpResponseMessage> Send(HttpMethod method, string url, UserRow owner) =>
        SendWithToken(method, url, TestTokens.Create(UserRole.Owner, owner.Id, owner.CompanyId));

    private Task<HttpResponseMessage> SendWithToken(HttpMethod method, string url, string accessToken)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return _client.SendAsync(request);
    }

    private async Task<string> LoginForAccessToken(string phone)
    {
        var response = await _client.LoginAsync(phone);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("accessToken").GetString()!;
    }

    private static async Task<List<JsonElement>> ReadUsers(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.EnumerateArray().Select(u => u.Clone()).ToList();
    }

    private static async Task AssertNotFound(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private async Task<UserRow> CreateOwner()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        return (await _db.FindUserAsync(phone))!;
    }

    // Неподтверждённый — как после регистрации
    private async Task<UserRow> CreateEmployee(UserRow owner, UserRole role, string fullName = "Иванов Иван Иванович")
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(role, owner.CompanyId, phone, fullName).EnsureCreated();
        return (await _db.FindUserAsync(phone))!;
    }
}
