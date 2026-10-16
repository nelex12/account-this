using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// DELETE /api/users/{id} (роль Owner): статусы и последствия увольнения. Про сессии — DeactivationRevokesSessionsTests.
[Collection("Api")]
public class DeactivateUserTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Deactivated_UserIsInactiveAndCannotLogIn()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{worker.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var users = await (await _client.SendAs(owner, HttpMethod.Get, "/api/users")).ReadJsonAsync();
        var json = users.EnumerateArray().Single(u => u.GetProperty("id").GetGuid() == worker.Id);
        Assert.False(json.GetProperty("isActive").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.LoginAsync(worker.Phone)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAs(worker, HttpMethod.Get, "/api/auth/worker-cert")).StatusCode);
    }

    [Fact]
    public async Task Self_Returns409AndStaysActive()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{owner.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await factory.Db.FindUserAsync(owner.Phone))!.IsActive);
    }

    [Fact]
    public async Task UnknownId_Returns404()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task NotUuid_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Delete, "/api/users/123");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("id", out _));
    }

    [Theory]
    [InlineData(UserRole.Issuer)]
    [InlineData(UserRole.Worker)]
    public async Task NotOwner_Returns403(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var caller = await factory.CreateEmployeeAsync(_client, owner, role);
        var colleague = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);

        var response = await _client.SendAs(caller, HttpMethod.Delete, $"/api/users/{colleague.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True((await factory.Db.FindUserAsync(colleague.Phone))!.IsActive);
    }

    // Владельца одной компании может уволить владелец той же компании, но не чужой
    [Fact]
    public async Task OwnerOfAnotherCompany_Returns404()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var strangerOwner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{strangerOwner.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.True((await factory.Db.FindUserAsync(strangerOwner.Phone))!.IsActive);
    }
}
