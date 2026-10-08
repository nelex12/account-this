using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/auth/login — без авторизации. 200 + JWT; 401 — неверный телефон или пароль;
// 403 — не подтверждён или уволен (только при верном пароле, иначе статус чужого аккаунта раскрывается).
[Collection("Api")]
public class LoginTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    [Fact]
    public async Task Owner_CanLoginRightAfterRegistration()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;

        var before = DateTime.UtcNow;
        var response = await _client.LoginAsync(phone);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.AccessToken);
        Assert.Equal(user.Id.ToString(), jwt.Payload.Sub);
        Assert.Equal("Owner", jwt.Payload["role"]);
        Assert.Equal(user.CompanyId.ToString(), jwt.Payload["company_id"]);
        // Срок — 12 часов от момента входа (секунды в JWT округляются вниз)
        Assert.InRange(jwt.ValidTo, before.AddHours(12).AddSeconds(-1), DateTime.UtcNow.AddHours(12).AddSeconds(1));
    }

    // Телефон нормализуется перед поиском: вход в любом допустимом формате
    [Fact]
    public async Task PhoneInAnotherFormat_LogsIn()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var d = phone[2..];

        var response = await _client.LoginAsync($"8 ({d[..3]}) {d[3..6]}-{d[6..8]}-{d[8..]}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task ApprovedEmployee_LogsInWithOwnRoleAndCompany(UserRole role)
    {
        var (user, _) = await CreateEmployee(role, isApproved: true, isActive: true);

        var response = await _client.LoginAsync(user.Phone);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body!.AccessToken);
        Assert.Equal(user.Id.ToString(), jwt.Payload.Sub);
        Assert.Equal(role.ToString(), jwt.Payload["role"]);
        Assert.Equal(user.CompanyId.ToString(), jwt.Payload["company_id"]);
    }

    [Fact]
    public async Task WrongPassword_Returns401()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();

        var response = await _client.LoginAsync(phone, "wrong-password");

        await AssertProblem(response, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UnknownPhone_Returns401()
    {
        var response = await _client.LoginAsync(TestDb.UniquePhone());

        await AssertProblem(response, HttpStatusCode.Unauthorized);
    }

    // Неизвестный телефон и неверный пароль неразличимы: иначе по ответу можно узнать, зарегистрирован ли номер
    [Fact]
    public async Task UnknownPhoneAndWrongPassword_LookTheSame()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();

        var wrongPassword = await _client.LoginAsync(phone, "wrong-password");
        var unknownPhone = await _client.LoginAsync(TestDb.UniquePhone());

        Assert.Equal(await Detail(wrongPassword), await Detail(unknownPhone));
    }

    [Fact]
    public async Task NotApproved_Returns403()
    {
        var (user, _) = await CreateEmployee(UserRole.Worker, isApproved: false, isActive: true);

        var response = await _client.LoginAsync(user.Phone);

        await AssertProblem(response, HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task Deactivated_Returns403(UserRole role)
    {
        var (user, _) = await CreateEmployee(role, isApproved: true, isActive: false);

        var response = await _client.LoginAsync(user.Phone);

        await AssertProblem(response, HttpStatusCode.Forbidden);
    }

    // Неподтверждённый и уволенный — разные причины, и у них разные пояснения
    [Fact]
    public async Task NotApprovedAndDeactivated_HaveDifferentDetails()
    {
        var (notApproved, _) = await CreateEmployee(UserRole.Worker, isApproved: false, isActive: true);
        var (deactivated, _) = await CreateEmployee(UserRole.Worker, isApproved: true, isActive: false);

        var first = await _client.LoginAsync(notApproved.Phone);
        var second = await _client.LoginAsync(deactivated.Phone);

        Assert.NotEqual(await Detail(first), await Detail(second));
    }

    // Статус аккаунта проверяется только после верного пароля
    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(false, false)]
    public async Task WrongPassword_HidesAccountStatus(bool isApproved, bool isActive)
    {
        var (user, _) = await CreateEmployee(UserRole.Worker, isApproved, isActive);

        var response = await _client.LoginAsync(user.Phone, "wrong-password");

        await AssertProblem(response, HttpStatusCode.Unauthorized);
    }

    // Регистрация через API, статус — напрямую в БД (подтверждение и увольнение через API — блок 4)
    private async Task<(UserRow User, Guid CompanyId)> CreateEmployee(UserRole role, bool isApproved, bool isActive)
    {
        var companyId = await _db.CreateCompanyAsync();
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(role, companyId, phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved, isActive);
        return (user, companyId);
    }

    private static async Task<string?> Detail(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("detail").GetString();
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.False(string.IsNullOrWhiteSpace(await Detail(response)));
    }
}
