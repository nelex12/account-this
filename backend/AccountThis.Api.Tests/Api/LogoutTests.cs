using System.Net;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/auth/logout — без JWT, refresh token в cookie. Всегда 204 с удалением cookie:
// сессия из cookie (если она была) завершается, остальные сессии пользователя не трогаются.
[Collection("Api")]
public class LogoutTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Fact]
    public async Task ValidToken_Returns204AndClearsCookie()
    {
        var (_, refreshToken) = await LoggedInOwner();

        var response = await _client.LogoutAsync(refreshToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
        response.AssertRefreshCookieCleared();
    }

    [Fact]
    public async Task AfterLogout_TokenNoLongerRefreshes()
    {
        var (_, refreshToken) = await LoggedInOwner();
        await _client.LogoutAsync(refreshToken);

        var response = await _client.RefreshAsync(refreshToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Выход гасит сессию, а не только предъявленный токен: токены из неё больше не действуют
    [Fact]
    public async Task AfterRotation_LogoutEndsSession()
    {
        var (_, first) = await LoggedInOwner();
        var second = (await _client.RefreshAsync(first)).RefreshToken();

        await _client.LogoutAsync(second);
        var response = await _client.RefreshAsync(second);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OtherSessionsOfSameUser_KeepWorking()
    {
        var (user, sessionA) = await LoggedInOwner();
        var sessionB = await _client.LoginForRefreshTokenAsync(user.Phone);

        await _client.LogoutAsync(sessionA);
        var response = await _client.RefreshAsync(sessionB);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // Сессии нет — результат тот же, что после выхода
    [Theory]
    [InlineData(null)]
    [InlineData("q8RzJ2vW0bXyL5nT3mKcA1sDfGhJkLzXcVbNm9QwErT")]
    [InlineData("not-a-token")]
    public async Task NoSession_StillReturns204(string? refreshToken)
    {
        var response = await _client.LogoutAsync(refreshToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        response.AssertRefreshCookieCleared();
    }

    [Fact]
    public async Task SecondLogout_Returns204()
    {
        var (_, refreshToken) = await LoggedInOwner();
        await _client.LogoutAsync(refreshToken);

        var response = await _client.LogoutAsync(refreshToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task<(UserRow User, string RefreshToken)> LoggedInOwner()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        return (user, await _client.LoginForRefreshTokenAsync(phone));
    }
}
