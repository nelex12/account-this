using System.Net;
using System.Net.Http.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// GET /api/auth/server-key — без авторизации, ServerKeyResponse
[Collection("Api")]
public class ServerKeyTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task ReturnsServerPublicKeyAndServerTime()
    {
        var before = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var response = await _client.GetAsync("/api/auth/server-key");

        var after = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ServerKeyResponse>();
        Assert.NotNull(body);
        Assert.Equal(TestKeys.ServerPublicKey, body.ServerPublicKey);
        // Unix time в секундах, не в миллисекундах
        Assert.InRange(body.ServerTime, before, after);
    }
}
