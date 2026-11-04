using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/auth/change-password — любая роль, JWT. В одной транзакции: новый хеш пароля, погашены все сессии
// пользователя, начата новая (ответ как у входа: access token в теле, refresh token в cookie).
// JWT собирается в тестах (TestTokens), refresh token-ы — из настоящего входа.
[Collection("Api")]
public class ChangePasswordTests(ApiFactory factory)
{
    private const string NewPassword = "Battery-Staple-2";

    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Owner)]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Worker)]
    public async Task ValidRequest_Returns200WithNewSession(UserRole role)
    {
        var user = await CreateUser(role);

        var response = await ChangePassword(user, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("accessToken").GetString()));
        Assert.Equal(900, body.GetProperty("expiresIn").GetInt32());
        var refreshToken = response.RefreshToken();
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(refreshToken)).StatusCode);
    }

    // Выданный access token рабочий: в нём тот же пользователь
    [Fact]
    public async Task NewAccessToken_Works()
    {
        var owner = await CreateUser(UserRole.Owner);

        var response = await ChangePassword(owner, AuthRequests.Password, NewPassword);
        var accessToken = (await response.ReadJsonAsync()).GetProperty("accessToken").GetString();

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/users/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var me = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(owner.Id, (await me.ReadJsonAsync()).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task AfterChange_LoginWorksOnlyWithNewPassword()
    {
        var owner = await CreateUser(UserRole.Owner);

        await ChangePassword(owner, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.LoginAsync(owner.Phone)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.LoginAsync(owner.Phone, NewPassword)).StatusCode);
    }

    // Пароль мог утечь: все прежние сессии на всех устройствах завершаются
    [Fact]
    public async Task AfterChange_AllPreviousSessionsEnd()
    {
        var owner = await CreateUser(UserRole.Owner);
        var phoneSession = await _client.LoginForRefreshTokenAsync(owner.Phone);
        var laptopSession = await _client.LoginForRefreshTokenAsync(owner.Phone);

        var response = await ChangePassword(owner, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(phoneSession)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(laptopSession)).StatusCode);
        Assert.Equal(1, await _db.CountActiveRefreshTokensAsync(owner.Id));
    }

    // Сессии других пользователей не затрагиваются
    [Fact]
    public async Task OtherUsersSessions_KeepWorking()
    {
        var owner = await CreateUser(UserRole.Owner);
        var colleague = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        var colleagueSession = await _client.LoginForRefreshTokenAsync(colleague.Phone);

        await ChangePassword(owner, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(colleagueSession)).StatusCode);
    }

    // Не 401: его клиент принял бы за истёкший access token
    [Fact]
    public async Task WrongCurrentPassword_Returns400AndChangesNothing()
    {
        var owner = await CreateUser(UserRole.Owner);
        var session = await _client.LoginForRefreshTokenAsync(owner.Phone);
        var hashBefore = (await _db.FindUserAsync(owner.Phone))!.PasswordHash;

        var response = await ChangePassword(owner, "wrong-password", NewPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("currentPassword", out _));
        Assert.Null(response.RefreshSetCookie());
        Assert.Equal(hashBefore, (await _db.FindUserAsync(owner.Phone))!.PasswordHash);
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(session)).StatusCode);
    }

    [Fact]
    public async Task SameAsCurrent_Returns400()
    {
        var owner = await CreateUser(UserRole.Owner);

        var response = await ChangePassword(owner, AuthRequests.Password, AuthRequests.Password);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("newPassword", out _));
    }

    [Theory]
    [InlineData("", NewPassword, "currentPassword")]
    [InlineData("   ", NewPassword, "currentPassword")]
    [InlineData(AuthRequests.Password, "", "newPassword")]
    [InlineData(AuthRequests.Password, "   ", "newPassword")]
    public async Task EmptyField_Returns400(string currentPassword, string newPassword, string errorKey)
    {
        var owner = await CreateUser(UserRole.Owner);

        var response = await ChangePassword(owner, currentPassword, newPassword);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty(errorKey, out _));
    }

    [Fact]
    public async Task MissingFields_Returns400()
    {
        var owner = await CreateUser(UserRole.Owner);

        var response = await _client.SendAs(owner, HttpMethod.Post, "/api/auth/change-password", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.ReadJsonAsync()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("currentPassword", out _));
        Assert.True(errors.TryGetProperty("newPassword", out _));
    }

    [Fact]
    public async Task NoJwt_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = AuthRequests.Password, newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Access token уволенного ещё действует, но is_active проверяется по БД
    [Fact]
    public async Task DeactivatedUser_Returns403AndChangesNothing()
    {
        var owner = await CreateUser(UserRole.Owner);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);
        await _db.SetUserFlagsAsync(worker.Id, isApproved: true, isActive: false);
        var hashBefore = (await _db.FindUserAsync(worker.Phone))!.PasswordHash;

        var response = await ChangePassword(worker, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(response.RefreshSetCookie());
        Assert.Equal(hashBefore, (await _db.FindUserAsync(worker.Phone))!.PasswordHash);
    }

    // sub из чужой компании неотличим от несуществующего пользователя
    [Fact]
    public async Task UserFromAnotherCompanyInJwt_Returns403()
    {
        var owner = await CreateUser(UserRole.Owner);
        var forged = owner with { CompanyId = Guid.NewGuid() };

        var response = await ChangePassword(forged, AuthRequests.Password, NewPassword);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private Task<TestUser> CreateUser(UserRole role) => role == UserRole.Owner
        ? factory.CreateOwnerAsync(_client)
        : CreateEmployee(role);

    private async Task<TestUser> CreateEmployee(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        return await factory.CreateEmployeeAsync(_client, owner, role);
    }

    private Task<HttpResponseMessage> ChangePassword(TestUser user, string currentPassword, string newPassword) =>
        _client.SendAs(user, HttpMethod.Post, "/api/auth/change-password", new { currentPassword, newPassword });
}
