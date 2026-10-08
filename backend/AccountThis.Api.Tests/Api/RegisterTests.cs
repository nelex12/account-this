using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/auth/register — без авторизации. 201 без тела; 400 — компании с таким companyId нет; 409 — телефон занят.
[Collection("Api")]
public class RegisterTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    [Fact]
    public async Task Owner_CreatesCompanyAndIsApprovedImmediately()
    {
        var phone = TestDb.UniquePhone();
        var companyName = "Компания " + Guid.NewGuid();

        var response = await _client.RegisterOwnerAsync(phone, companyName, fullName: "Сидоров Сидор");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());

        var user = await _db.FindUserAsync(phone);
        Assert.NotNull(user);
        Assert.Equal("Сидоров Сидор", user.FullName);
        Assert.Equal("Owner", user.Role);
        Assert.True(user.IsApproved);
        Assert.True(user.IsActive);
        Assert.Equal(companyName, await _db.FindCompanyNameAsync(user.CompanyId));
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task Employee_JoinsExistingCompanyAndWaitsForApproval(UserRole role)
    {
        var companyId = await _db.CreateCompanyAsync();
        var phone = TestDb.UniquePhone();

        var response = await _client.RegisterEmployeeAsync(role, companyId, phone);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());

        var user = await _db.FindUserAsync(phone);
        Assert.NotNull(user);
        Assert.Equal(role.ToString(), user.Role);
        Assert.Equal(companyId, user.CompanyId);
        Assert.False(user.IsApproved);
        Assert.True(user.IsActive);
    }

    // Телефон хранится в виде +7XXXXXXXXXX, как бы его ни ввели
    [Theory]
    [InlineData("8{0}")]
    [InlineData("7{0}")]
    [InlineData("+7 ({1}) {2}-{3}-{4}")]
    public async Task Phone_IsStoredNormalized(string format)
    {
        var phone = TestDb.UniquePhone();
        var input = FormatPhone(format, phone);

        var response = await _client.RegisterOwnerAsync(input);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(await _db.FindUserAsync(phone));
    }

    [Fact]
    public async Task Password_IsNotStoredInPlainText()
    {
        var phone = TestDb.UniquePhone();

        await _client.RegisterOwnerAsync(phone).EnsureCreated();

        var user = await _db.FindUserAsync(phone);
        Assert.NotNull(user);
        Assert.DoesNotContain(AuthRequests.Password, user.PasswordHash);
    }

    [Fact]
    public async Task SamePhoneInAnotherFormat_Returns409()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();

        var response = await _client.RegisterOwnerAsync(FormatPhone("8 ({1}) {2}-{3}-{4}", phone));

        await AssertProblem(response, HttpStatusCode.Conflict);
    }

    // Уникальность телефона не зависит от роли и компании
    [Fact]
    public async Task EmployeeWithTakenPhone_Returns409()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var otherCompanyId = await _db.CreateCompanyAsync();

        var response = await _client.RegisterEmployeeAsync(UserRole.Worker, otherCompanyId, phone);

        await AssertProblem(response, HttpStatusCode.Conflict);
    }

    // «Если регистрация не удалась (409), компания не создаётся»
    [Fact]
    public async Task OwnerWithTakenPhone_DoesNotCreateCompany()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var secondCompanyName = "Не должна появиться " + Guid.NewGuid();

        var response = await _client.RegisterOwnerAsync(phone, secondCompanyName);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(0, await _db.CountCompaniesAsync(secondCompanyName));
    }

    // Пользователь уволен, но телефон всё равно занят
    [Fact]
    public async Task PhoneOfDeactivatedUser_IsStillTaken()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved: true, isActive: false);

        var response = await _client.RegisterOwnerAsync(phone);

        await AssertProblem(response, HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task UnknownCompanyId_Returns400WithCompanyIdError(UserRole role)
    {
        var phone = TestDb.UniquePhone();

        var response = await _client.RegisterEmployeeAsync(role, Guid.NewGuid(), phone);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.GetProperty("errors").TryGetProperty("companyId", out _));
        Assert.Null(await _db.FindUserAsync(phone));
    }

    // {0} — 10 цифр после +7, {1}..{4} — группы 3-3-2-2
    private static string FormatPhone(string format, string normalizedPhone)
    {
        var d = normalizedPhone[2..];
        return string.Format(format, d, d[..3], d[3..6], d[6..8], d[8..]);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("detail").GetString()));
    }
}
