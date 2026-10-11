using System.Net;
using System.Net.Http.Headers;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// DELETE /api/users/{id} (роль Owner, блок 4) — часть про сессии: увольнение запоминает момент увольнения
// и в той же транзакции гасит все refresh token пользователя. Остальное поведение увольнения — в тестах блока 4.
// Owner вызывает API с JWT из TestTokens, чтобы тесты не зависели от входа Owner.
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

    // Гасятся только сессии уволенного
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

    // Момент увольнения — время сервера; по нему /api/sync выставляет WORKER_DEACTIVATED
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

    // Повторный вызов — 200, но момент увольнения не переписывается: иначе операции между первым
    // и вторым вызовом перестали бы считаться совершёнными после увольнения
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

    // Пользователь другой компании — 404, и его сессии не трогаются
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

    // Регистрация через API, подтверждение — напрямую в БД (не зависит от approve)
    private async Task<UserRow> CreateApprovedEmployee(UserRow owner, UserRole role)
    {
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(role, owner.CompanyId, phone).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved: true, isActive: true);
        return user;
    }
}
