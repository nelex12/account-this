using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// Проверка JWT и ролей — до контроллера (api.yaml, «Ошибки»): 401/403 без тела, у 401 заголовок WWW-Authenticate: Bearer.
// Берётся /api/auth/worker-cert (роль Worker): до сервиса эти запросы дойти не должны, поэтому БД не нужна.
[Collection("Api")]
public class AuthenticationPipelineTests(ApiFactory factory)
{
    private const string WorkerOnlyUrl = "/api/auth/worker-cert";

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task NoToken_Returns401WithBearerChallengeAndNoBody()
    {
        var response = await _client.GetAsync(WorkerOnlyUrl);

        await AssertUnauthorized(response);
    }

    [Fact]
    public async Task GarbageToken_Returns401()
    {
        var response = await SendWithToken(WorkerOnlyUrl, "not.a.jwt");

        await AssertUnauthorized(response);
    }

    [Fact]
    public async Task TokenSignedWithAnotherKey_Returns401()
    {
        var token = TestTokens.Create(UserRole.Worker, signingKey: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc");

        var response = await SendWithToken(WorkerOnlyUrl, token);

        await AssertUnauthorized(response);
    }

    [Fact]
    public async Task ExpiredToken_Returns401()
    {
        var token = TestTokens.Create(UserRole.Worker, expires: DateTime.UtcNow.AddHours(-1));

        var response = await SendWithToken(WorkerOnlyUrl, token);

        await AssertUnauthorized(response);
    }

    [Theory]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Owner)]
    public async Task WrongRole_Returns403WithoutBody(UserRole role)
    {
        var response = await SendWithToken(WorkerOnlyUrl, TestTokens.Create(role));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    // Защищён весь контроллер (атрибут на классе), а не только отдельные методы
    [Theory]
    [InlineData("/api/tools")]
    [InlineData("/api/users")]
    [InlineData("/api/companies/my")]
    [InlineData("/api/logs")]
    public async Task ProtectedEndpoints_WithoutToken_Return401(string url)
    {
        var response = await _client.GetAsync(url);

        await AssertUnauthorized(response);
    }

    // Во всех ProblemDetails есть traceId (api.yaml, «Ошибки»)
    [Fact]
    public async Task ValidationError_IsProblemDetailsWithTraceId()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("traceId", out _));
        Assert.True(body.RootElement.TryGetProperty("errors", out _));
    }

    private Task<HttpResponseMessage> SendWithToken(string url, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return _client.SendAsync(request);
    }

    private static async Task AssertUnauthorized(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains(response.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }
}
