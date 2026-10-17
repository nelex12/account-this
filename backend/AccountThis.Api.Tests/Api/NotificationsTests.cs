using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// Уведомления Owner (api.yaml: /api/notifications; docs/events.md, «Потребитель notifications»).
// Их создаёт Worker по событиям из RabbitMQ, поэтому тесты ждут уведомление с таймаутом.
// Отсутствие уведомления проверяется «барьером»: после действия без уведомления регистрируется сотрудник —
// очередь notifications одна и обрабатывается по порядку, поэтому к его уведомлению первое тоже было бы создано.
[Collection("Api")]
public class NotificationsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();

    // ---------- Доступ ----------

    [Fact]
    public async Task WithoutToken_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/notifications")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsync("/api/notifications/1/read", null)).StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task NotOwner_Returns403(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var employee = await factory.CreateEmployeeAsync(_client, owner, role);

        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAs(employee, HttpMethod.Get, "/api/notifications")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAs(employee, HttpMethod.Post, "/api/notifications/1/read")).StatusCode);
    }

    // ---------- Сотрудник ждёт подтверждения ----------

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task EmployeeRegistration_CreatesAwaitingApproval(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var employee = await factory.CreateEmployeeAsync(_client, owner, role, fullName: "Сидоров Сидор", isApproved: false);

        var notification = await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", employee.Id);

        Assert.Equal("Сидоров Сидор", notification.GetProperty("userName").GetString());
        Assert.False(notification.GetProperty("isRead").GetBoolean());
        Assert.Equal(JsonValueKind.Null, notification.GetProperty("flags").ValueKind);
        Assert.Equal(JsonValueKind.Number, notification.GetProperty("id").ValueKind);
        Assert.InRange(notification.GetProperty("occurredAt").GetInt64(), QrBuilder.Now - 60, QrBuilder.Now);
    }

    // Owner подтверждается сам — уведомлять не о чем
    [Fact]
    public async Task OwnerRegistration_CreatesNothing()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        await Barrier(owner);

        Assert.DoesNotContain(await GetNotificationsAsync(owner), n => n.GetProperty("userId").GetGuid() == owner.Id);
    }

    // Решение Owner (подтвердить или уволить) снимает уведомление: оно становится прочитанным
    [Theory]
    [InlineData("approve")]
    [InlineData("deactivate")]
    public async Task OwnerDecision_MarksAwaitingApprovalRead(string decision)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);
        await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", worker.Id);

        var response = decision == "approve"
            ? await _client.SendAs(owner, HttpMethod.Post, $"/api/users/{worker.Id}/approve")
            : await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{worker.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", worker.Id, n => n.GetProperty("isRead").GetBoolean());
    }

    // ---------- Повтор погашенного refresh token ----------

    [Fact]
    public async Task RefreshTokenReuse_CreatesSessionReuseDetected()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, fullName: "Козлов Кирилл");
        var first = await _client.LoginForRefreshTokenAsync(worker.Phone);
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(first)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(first)).StatusCode);

        var notification = await WaitForNotificationAsync(owner, "SessionReuseDetected", worker.Id);
        Assert.Equal("Козлов Кирилл", notification.GetProperty("userName").GetString());
    }

    // ---------- Подозрительная синхронизация ----------

    // В flags — только новые записи с флагами, отличными от VALID
    [Fact]
    public async Task SyncWithFlaggedRecords_CreatesSuspiciousSync()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer, fullName: "Завхоз Захар");
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);
        var toolId = await _client.CreateToolAsync(owner);
        using var qr = QrBuilder.Forge(worker.Id);
        var now = QrBuilder.Now;

        var response = await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", new[]
        {
            new { qr = qr.Qr(RentalAction.TAKE, toolId, now - 5), scannedAt = now - 5 },
            new { qr = qr.Qr(RentalAction.GIVE, Guid.NewGuid(), now - 3), scannedAt = now - 3 },
            new { qr = qr.Qr(RentalAction.GIVE, toolId, now - 200), scannedAt = now },
            new { qr = qr.Qr(RentalAction.GIVE, toolId, now - 2, signWithForeignKey: true), scannedAt = now - 2 },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var notification = await WaitForNotificationAsync(owner, "SuspiciousSync", issuer.Id);
        Assert.Equal("Завхоз Захар", notification.GetProperty("userName").GetString());
        var flags = notification.GetProperty("flags");
        Assert.Equal(1, flags.GetProperty("UNKNOWN_TOOL").GetInt32());
        Assert.Equal(1, flags.GetProperty("TIME_DRIFT").GetInt32());
        Assert.Equal(1, flags.GetProperty("INVALID_WORKER_SIG").GetInt32());
        Assert.False(flags.TryGetProperty("VALID", out _), "VALID в уведомление не попадает");
    }

    [Fact]
    public async Task SyncWithOnlyValidRecords_CreatesNothing()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);
        var toolId = await _client.CreateToolAsync(owner);
        using var qr = QrBuilder.Forge(worker.Id);
        var now = QrBuilder.Now;

        var response = await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", new[]
        {
            new { qr = qr.Qr(RentalAction.TAKE, toolId, now - 5), scannedAt = now - 5 },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Barrier(owner);

        Assert.DoesNotContain(await GetNotificationsAsync(owner), n => n.GetProperty("type").GetString() == "SuspiciousSync");
    }

    // ---------- Список и отметка о прочтении ----------

    // Новые сверху
    [Fact]
    public async Task List_IsNewestFirst()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var first = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);
        await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", first.Id);
        var second = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);
        await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", second.Id);

        var ids = (await GetNotificationsAsync(owner)).Select(n => n.GetProperty("userId").GetGuid()).ToList();

        Assert.Equal([second.Id, first.Id], ids);
    }

    [Fact]
    public async Task MarkRead_SetsIsReadAndIsIdempotent()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);
        var id = (await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", worker.Id)).GetProperty("id").GetInt64();

        Assert.Equal(HttpStatusCode.OK, (await _client.SendAs(owner, HttpMethod.Post, $"/api/notifications/{id}/read")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAs(owner, HttpMethod.Post, $"/api/notifications/{id}/read")).StatusCode);

        var notification = (await GetNotificationsAsync(owner)).Single(n => n.GetProperty("id").GetInt64() == id);
        Assert.True(notification.GetProperty("isRead").GetBoolean());
    }

    [Fact]
    public async Task MarkRead_Unknown_Returns404()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Post, $"/api/notifications/{long.MaxValue}/read");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task MarkRead_NotANumber_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Post, "/api/notifications/abc/read");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("id", out _));
    }

    // Компании изолированы: чужих уведомлений не видно, отметить чужое нельзя (404, неотличимо от несуществующего)
    [Fact]
    public async Task OtherCompany_IsIsolated()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);
        var id = (await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", worker.Id)).GetProperty("id").GetInt64();
        var stranger = await factory.CreateOwnerAsync(_client);

        Assert.DoesNotContain(await GetNotificationsAsync(stranger), n => n.GetProperty("id").GetInt64() == id);
        Assert.Equal(HttpStatusCode.NotFound,
            (await _client.SendAs(stranger, HttpMethod.Post, $"/api/notifications/{id}/read")).StatusCode);

        var own = (await GetNotificationsAsync(owner)).Single(n => n.GetProperty("id").GetInt64() == id);
        Assert.False(own.GetProperty("isRead").GetBoolean(), "Попытка чужого Owner не отметила уведомление");
    }

    private async Task<List<JsonElement>> GetNotificationsAsync(TestUser owner)
    {
        var response = await _client.SendAs(owner, HttpMethod.Get, "/api/notifications");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.ReadJsonAsync()).EnumerateArray().ToList();
    }

    private async Task<JsonElement> WaitForNotificationAsync(
        TestUser owner, string type, Guid userId, Func<JsonElement, bool>? condition = null)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (true)
        {
            var match = (await GetNotificationsAsync(owner)).FirstOrDefault(n =>
                n.GetProperty("type").GetString() == type
                && n.GetProperty("userId").GetGuid() == userId
                && (condition is null || condition(n)));
            if (match.ValueKind != JsonValueKind.Undefined)
            {
                return match;
            }

            Assert.True(DateTime.UtcNow < deadline, $"Уведомление {type} о {userId} не появилось");
            await Task.Delay(100);
        }
    }

    // Действие, которое точно создаёт уведомление, — после него все ранее отправленные события уже обработаны
    private async Task Barrier(TestUser owner)
    {
        var employee = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, fullName: "Барьер", isApproved: false);
        await WaitForNotificationAsync(owner, "EmployeeAwaitingApproval", employee.Id);
    }
}
