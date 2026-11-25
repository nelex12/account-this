using System.Net;
using System.Net.Http.Headers;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

[Collection("Api")]
public class DeactivationRevokesSessionsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task Deactivation_EndsAllSessionsOfUser(UserRole role)
    {
        var owner = await CreateOwner();
        var employee = await CreateApprovedEmployee(owner, role);
        var phoneSession = await _client.LoginForRefreshTokenAsync(employee.Phone);
        var laptopSession = await _client.LoginForRefreshTokenAsync(employee.Phone);

        var response = await Deactivate(owner, employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, await _db.CountActiveRefreshTokensAsync(employee.Id));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(phoneSession)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(laptopSession)).StatusCode);
    }

    [Fact]
    public async Task Deactivation_DoesNotEndOtherUsersSessions()
    {
        var owner = await CreateOwner();
        var employee = await CreateApprovedEmployee(owner, UserRole.Worker);
        var colleague = await CreateApprovedEmployee(owner, UserRole.Worker);
        await _client.LoginForRefreshTokenAsync(employee.Phone);
        var colleagueSession = await _client.LoginForRefreshTokenAsync(colleague.Phone);
        var ownerSession = await _client.LoginForRefreshTokenAsync(owner.Phone);

        await Deactivate(owner, employee.Id);

        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(colleagueSession)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(ownerSession)).StatusCode);
    }

    [Fact]
    public async Task Deactivation_RecordsDeactivatedAt()
    {
        var owner = await CreateOwner();
        var employee = await CreateApprovedEmployee(owner, UserRole.Worker);

        var before = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await Deactivate(owner, employee.Id);
        var after = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var deactivatedAt = await _db.FindDeactivatedAtAsync(employee.Id);
        Assert.NotNull(deactivatedAt);
        Assert.InRange(deactivatedAt.Value, before, after);
    }

    [Fact]
    public async Task RepeatedDeactivation_KeepsOriginalDeactivatedAt()
    {
        var owner = await CreateOwner();
        var employee = await CreateApprovedEmployee(owner, UserRole.Worker);
        await Deactivate(owner, employee.Id);
        await _db.ShiftDeactivatedAtAsync(employee.Id, TimeSpan.FromHours(1));
        var original = await _db.FindDeactivatedAtAsync(employee.Id);

        var response = await Deactivate(owner, employee.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(original, await _db.FindDeactivatedAtAsync(employee.Id));
    }

    [Fact]
    public async Task UserOfAnotherCompany_SessionsUntouched()
    {
        var owner = await CreateOwner();
        var stranger = await CreateApprovedEmployee(await CreateOwner(), UserRole.Worker);
        var strangerSession = await _client.LoginForRefreshTokenAsync(stranger.Phone);

        var response = await Deactivate(owner, stranger.Id);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(strangerSession)).StatusCode);
    }

    private Task<HttpResponseMessage> Deactivate(UserRow owner, Guid userId)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/users/{userId}");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestTokens.Create(UserRole.Owner, owner.Id, owner.CompanyId));
        return _client.SendAsync(request);
    }

    private async Task<UserRow> CreateOwner()
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterOwnerAsync(phone).EnsureCreated();
        return (await _db.FindUserAsync(phone))!;
    }

    private async Task<UserRow> CreateApprovedEmployee(UserRow owner, UserRole role)
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(role, owner.CompanyId, phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved: true, isActive: true);
        return user;
    }
}
