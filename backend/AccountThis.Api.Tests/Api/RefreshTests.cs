using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/auth/refresh — без JWT, refresh token в cookie. 200: новый access token в теле и новый refresh token
// в cookie (ротация: предъявленный гасится). 401 с ProblemDetails и удалением cookie — во всех остальных случаях.
// Повторное предъявление погашенного ротацией токена гасит всю сессию.
[Collection("Api")]
public class RefreshTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Fact]
    public async Task ValidToken_ReturnsNewAccessTokenForSameUser()
    {
        var (user, refreshToken) = await LoggedInOwner();

        var before = DateTime.UtcNow;
        var response = await _client.RefreshAsync(refreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(900, body.RootElement.GetProperty("expiresIn").GetInt32());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.RootElement.GetProperty("accessToken").GetString());
        Assert.Equal(user.Id.ToString(), jwt.Payload.Sub);
        Assert.Equal("Owner", jwt.Payload["role"]);
        Assert.Equal(user.CompanyId.ToString(), jwt.Payload["company_id"]);
        Assert.InRange(jwt.ValidTo, before.AddMinutes(15).AddSeconds(-1), DateTime.UtcNow.AddMinutes(15).AddSeconds(1));
    }

    [Fact]
    public async Task ValidToken_RotatesCookie()
    {
        var (_, refreshToken) = await LoggedInOwner();

        var response = await _client.RefreshAsync(refreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = response.RefreshSetCookie();
        Assert.NotNull(cookie);
        Assert.True(cookie.HttpOnly, "HttpOnly");
        Assert.True(cookie.Secure, "Secure");
        Assert.Equal("/api/auth", cookie.Path.Value);
        Assert.Equal(TimeSpan.FromDays(30), cookie.MaxAge);
        Assert.NotEqual(refreshToken, response.RefreshToken());
    }

    // Сессия продолжается по цепочке: каждый новый токен снова обменивается
    [Fact]
    public async Task NewToken_CanBeRefreshedAgain()
    {
        var (_, refreshToken) = await LoggedInOwner();

        for (var i = 0; i < 3; i++)
        {
            var response = await _client.RefreshAsync(refreshToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            refreshToken = response.RefreshToken();
        }
    }

    [Fact]
    public async Task NoCookie_Returns401()
    {
        var response = await _client.RefreshAsync(refreshToken: null);

        await AssertSessionGone(response);
    }

    [Theory]
    [InlineData("q8RzJ2vW0bXyL5nT3mKcA1sDfGhJkLzXcVbNm9QwErT")] // правильный формат, но такого токена не выдавали
    [InlineData("not-a-token")]
    [InlineData("")]
    public async Task UnknownToken_Returns401(string refreshToken)
    {
        var response = await _client.RefreshAsync(refreshToken);

        await AssertSessionGone(response);
    }

    [Fact]
    public async Task ExpiredToken_Returns401()
    {
        var (_, refreshToken) = await LoggedInOwner();
        await _db.ExpireRefreshTokenAsync(refreshToken);

        var response = await _client.RefreshAsync(refreshToken);

        await AssertSessionGone(response);
    }

    // Старый токен после ротации — повторное предъявление: признак кражи, гасится вся сессия,
    // включая токен, выданный взамен (иначе вор, успевший обменять токен первым, сохранил бы доступ)
    [Fact]
    public async Task RotatedTokenReused_Returns401AndEndsWholeSession()
    {
        var (_, first) = await LoggedInOwner();
        var second = (await _client.RefreshAsync(first)).RefreshToken();

        var reuse = await _client.RefreshAsync(first);
        var afterReuse = await _client.RefreshAsync(second);

        await AssertSessionGone(reuse);
        await AssertSessionGone(afterReuse);
    }

    // Повтор в одной сессии не трогает другие сессии того же пользователя (другие устройства)
    [Fact]
    public async Task RotatedTokenReused_DoesNotEndOtherSessions()
    {
        var (user, sessionA) = await LoggedInOwner();
        var sessionB = await _client.LoginForRefreshTokenAsync(user.Phone);
        await _client.RefreshAsync(sessionA);

        await _client.RefreshAsync(sessionA);
        var response = await _client.RefreshAsync(sessionB);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // Защита на случай, если токен не погасили: статус аккаунта проверяется по БД при каждом обновлении.
    // Флаг меняется в обход API, поэтому refresh token остаётся непогашенным
    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task DeactivatedUser_Returns401(UserRole role)
    {
        var companyId = await _db.CreateCompanyAsync();
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(role, companyId, phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved: true, isActive: true);
        var refreshToken = await _client.LoginForRefreshTokenAsync(phone);
        await _db.SetUserFlagsAsync(user.Id, isApproved: true, isActive: false);

        var response = await _client.RefreshAsync(refreshToken);

        await AssertSessionGone(response);
    }

    // Обмен не требует JWT: access token к этому моменту обычно уже истёк
    [Fact]
    public async Task ExpiredAccessTokenInHeader_DoesNotMatter()
    {
        var (user, refreshToken) = await LoggedInOwner();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", $"{AuthRequests.RefreshCookieName}={refreshToken}");
        request.Headers.Authorization = new("Bearer",
            TestTokens.Create(UserRole.Owner, user.Id, user.CompanyId, expires: DateTime.UtcNow.AddHours(-1)));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<(UserRow User, string RefreshToken)> LoggedInOwner()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        return (user, await _client.LoginForRefreshTokenAsync(phone));
    }

    // Причины не различаются: клиенту в любом случае нужно войти заново
    private static async Task AssertSessionGone(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("detail").GetString()));
        response.AssertRefreshCookieCleared();
    }
}
