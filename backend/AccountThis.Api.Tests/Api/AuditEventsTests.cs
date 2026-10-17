using System.Net;
using System.Text;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;
using RabbitMQ.Client;

namespace AccountThis.Api.Tests.Api;

// Журнал аудита (docs/events.md): действие через API → outbox_events в той же транзакции → OutboxDispatcher → RabbitMQ →
// потребитель audit (Worker) → строка audit_events. Запись асинхронная, поэтому тесты ждут строку с таймаутом. Событие только при реальном изменении состояния.
// Отсутствие события проверяется «барьером»: после действия без события выполняется действие с событием;
// очередь одна и обрабатывается по порядку, поэтому к появлению второго события первое тоже было бы записано.
[Collection("Api")]
public class AuditEventsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CookieClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Issuer)]
    public async Task Register_PublishesUserRegistered(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var employee = await factory.CreateEmployeeAsync(_client, owner, role, isApproved: false);

        var rows = await _db.WaitForAuditEventsAsync(owner.CompanyId, "user.registered", count: 2);

        var ownerEvent = rows.Single(r => r.ActorId == owner.Id);
        Assert.Equal("Owner", ownerEvent.Data.GetProperty("role").GetString());
        var employeeEvent = rows.Single(r => r.ActorId == employee.Id);
        Assert.Equal(employee.Id, employeeEvent.Data.GetProperty("userId").GetGuid());
        Assert.Equal(role.ToString(), employeeEvent.Data.GetProperty("role").GetString());
    }

    // Общие поля сообщения; телефоны, пароли и токены в события не попадают
    [Fact]
    public async Task Event_HasEnvelopeFieldsAndNoSecrets()
    {
        var before = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var owner = await factory.CreateOwnerAsync(_client);
        await _client.LoginAsync(owner.Phone);

        var row = (await _db.WaitForAuditEventsAsync(owner.CompanyId, "auth.logged_in")).Single();

        Assert.NotEqual(Guid.Empty, row.EventId);
        Assert.Equal(owner.Id, row.ActorId);
        Assert.InRange(row.OccurredAt, before, DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        Assert.Equal(JsonValueKind.Object, row.Data.ValueKind);
        var registered = (await _db.WaitForAuditEventsAsync(owner.CompanyId, "user.registered")).Single();
        var raw = registered.Data.GetRawText();
        Assert.DoesNotContain(owner.Phone, raw);
        Assert.DoesNotContain(AuthRequests.Password, raw);
    }

    [Fact]
    public async Task FailedLogin_PublishesNothing()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        await _client.LoginAsync(owner.Phone, "wrong-password");
        await _client.SendAs(owner, HttpMethod.Post, "/api/tools", new { name = "Барьер" });

        await _db.WaitForAuditEventsAsync(owner.CompanyId, "tool.created");

        Assert.Empty(await _db.FindAuditEventsAsync(owner.CompanyId, "auth.logged_in"));
    }

    // Подтверждение — событие только при первом вызове
    [Fact]
    public async Task Approve_PublishesOnlyOnFirstCall()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, isApproved: false);

        Assert.Equal(HttpStatusCode.OK, (await _client.SendAs(owner, HttpMethod.Post, $"/api/users/{worker.Id}/approve")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAs(owner, HttpMethod.Post, $"/api/users/{worker.Id}/approve")).StatusCode);
        await Barrier(owner);

        var row = Assert.Single(await _db.FindAuditEventsAsync(owner.CompanyId, "user.approved"));
        Assert.Equal(owner.Id, row.ActorId);
        Assert.Equal(worker.Id, row.Data.GetProperty("userId").GetGuid());
    }

    [Fact]
    public async Task Deactivate_PublishesOnceWithRevokedSessions()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);
        await _client.LoginForRefreshTokenAsync(worker.Phone);
        await _client.LoginForRefreshTokenAsync(worker.Phone);

        await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{worker.Id}");
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/users/{worker.Id}");
        await Barrier(owner);

        var row = Assert.Single(await _db.FindAuditEventsAsync(owner.CompanyId, "user.deactivated"));
        Assert.Equal(owner.Id, row.ActorId);
        Assert.Equal(worker.Id, row.Data.GetProperty("userId").GetGuid());
        Assert.Equal(2, row.Data.GetProperty("revokedSessions").GetInt32());
    }

    // Погашенный ротацией токен живой сессии предъявлен снова — признак кражи
    [Fact]
    public async Task RefreshTokenReuse_PublishesSessionReuseDetected()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var first = await _client.LoginForRefreshTokenAsync(owner.Phone);
        Assert.Equal(HttpStatusCode.OK, (await _client.RefreshAsync(first)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.RefreshAsync(first)).StatusCode);

        var row = (await _db.WaitForAuditEventsAsync(owner.CompanyId, "auth.session_reuse_detected")).Single();
        Assert.Equal(owner.Id, row.ActorId);
    }

    // Повтор после выхода — сессия уже завершена, это не кража
    [Fact]
    public async Task RefreshAfterLogout_IsNotReuse()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var token = await _client.LoginForRefreshTokenAsync(owner.Phone);
        await _client.LogoutAsync(token);

        await _client.RefreshAsync(token);
        await Barrier(owner);

        Assert.Empty(await _db.FindAuditEventsAsync(owner.CompanyId, "auth.session_reuse_detected"));
    }

    [Fact]
    public async Task ToolLifecycle_PublishesCreatedUpdatedWrittenOff()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        var toolId = await _client.CreateToolAsync(issuer, "Болгарка");

        await _client.SendAs(issuer, HttpMethod.Patch, $"/api/tools/{toolId}", new { condition = "Damaged" });
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{toolId}");
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{toolId}");
        await Barrier(owner);

        var created = Assert.Single(await _db.FindAuditEventsAsync(owner.CompanyId, "tool.created"),
            r => r.Data.GetProperty("toolId").GetGuid() == toolId);
        Assert.Equal(issuer.Id, created.ActorId);
        Assert.Equal("Болгарка", created.Data.GetProperty("name").GetString());

        var updated = Assert.Single(await _db.FindAuditEventsAsync(owner.CompanyId, "tool.updated"));
        Assert.Equal(issuer.Id, updated.ActorId);
        Assert.Equal("Damaged", updated.Data.GetProperty("condition").GetString());
        Assert.False(updated.Data.TryGetProperty("comment", out _), "Не переданное поле в событие не попадает");

        var writtenOff = Assert.Single(await _db.FindAuditEventsAsync(owner.CompanyId, "tool.written_off"));
        Assert.Equal(owner.Id, writtenOff.ActorId);
        Assert.Equal(toolId, writtenOff.Data.GetProperty("toolId").GetGuid());
    }

    // Одно событие на запрос: всего записей, новых (без повторной отправки) и новых по флагам
    [Fact]
    public async Task Sync_PublishesOneEventWithCounts()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker);
        var toolId = await _client.CreateToolAsync(owner);
        using var qr = QrBuilder.Forge(worker.Id);
        var now = QrBuilder.Now;
        var valid = new { qr = qr.Qr(RentalAction.TAKE, toolId, now - 5), scannedAt = now - 5 };
        await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", new[] { valid });

        var response = await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", new[]
        {
            valid,
            new { qr = qr.Qr(RentalAction.GIVE, toolId, now - 3), scannedAt = now - 3 },
            new { qr = qr.Qr(RentalAction.GIVE, Guid.NewGuid(), now - 2), scannedAt = now - 2 },
            new { qr = qr.Qr(RentalAction.GIVE, toolId, now - 200), scannedAt = now },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rows = await _db.WaitForAuditEventsAsync(owner.CompanyId, "rental.synced", count: 2);
        var last = rows[1];
        Assert.Equal(issuer.Id, last.ActorId);
        Assert.Equal(4, last.Data.GetProperty("total").GetInt32());
        Assert.Equal(3, last.Data.GetProperty("created").GetInt32());
        var flags = last.Data.GetProperty("flags");
        Assert.Equal(1, flags.GetProperty("VALID").GetInt32());
        Assert.Equal(1, flags.GetProperty("UNKNOWN_TOOL").GetInt32());
        Assert.Equal(1, flags.GetProperty("TIME_DRIFT").GetInt32());
    }

    // Пустой массив и отклонённый (400) запрос событий не создают
    [Fact]
    public async Task EmptyOrRejectedSync_PublishesNothing()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", Array.Empty<object>());
        await _client.SendAs(issuer, HttpMethod.Post, "/api/sync", new[] { new { qr = "AT1.bad", scannedAt = 1L } });
        await Barrier(owner);

        Assert.Empty(await _db.FindAuditEventsAsync(owner.CompanyId, "rental.synced"));
    }

    // ---------- Outbox ----------

    // Отправленное событие удаляется из outbox
    [Fact]
    public async Task Outbox_IsEmptiedAfterPublish()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var row = (await _db.WaitForAuditEventsAsync(owner.CompanyId, "user.registered")).Single();

        await WaitUntil(async () => await _db.CountOutboxEventsAsync(row.EventId) == 0, "Событие осталось в outbox_events");
    }

    // Событие, зафиксированное, но не отправленное (приложение упало, брокер был недоступен), отправляется позже:
    // строка в outbox без сигнала NOTIFY — диспетчер находит её при периодической проверке
    [Fact]
    public async Task Outbox_PendingEventWithoutSignal_IsDeliveredLater()
    {
        var eventId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        await _db.InsertOutboxEventAsync(eventId, "test.pending", companyId, actorId: Guid.NewGuid(), data: "{\"n\": 1}");

        var row = (await _db.WaitForAuditEventsAsync(companyId, "test.pending", timeoutSeconds: 30)).Single();
        Assert.Equal(eventId, row.EventId);
        Assert.Equal(1, row.Data.GetProperty("n").GetInt32());
        await WaitUntil(async () => await _db.CountOutboxEventsAsync(eventId) == 0, "Событие осталось в outbox_events");
    }

    // ---------- Потребитель ----------

    // Повторная доставка того же события (тот же eventId) — одна строка
    [Fact]
    public async Task Consumer_RedeliveredEvent_IsStoredOnce()
    {
        var eventId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var body = JsonSerializer.Serialize(new
        {
            eventId,
            type = "test.redelivered",
            occurredAt = 1790000000L,
            companyId,
            actorId = Guid.NewGuid(),
            data = new { n = 1 },
        });

        await PublishRawAsync("test.redelivered", body);
        await PublishRawAsync("test.redelivered", body);
        await _db.WaitForAuditEventsAsync(companyId, "test.redelivered");
        await PublishRawAsync("test.barrier", JsonSerializer.Serialize(new
        {
            eventId = Guid.NewGuid(), type = "test.barrier", occurredAt = 1790000000L, companyId, actorId = Guid.NewGuid(), data = new { },
        }));
        await _db.WaitForAuditEventsAsync(companyId, "test.barrier");

        Assert.Equal(1, await _db.CountAuditEventsAsync(eventId));
    }

    // Неразбираемое сообщение уходит в очередь отказов events.dead, а не крутится в audit
    [Fact]
    public async Task Consumer_MalformedMessage_GoesToDeadLetterQueue()
    {
        var marker = Guid.NewGuid().ToString();

        await PublishRawAsync("test.malformed", "{\"not\":\"an event\",\"marker\":\"" + marker + "\"}");

        await WaitForDeadLetterAsync(marker);
    }

    // Контракт типа проверяет каждый потребитель сам: конверт верный — audit записывает событие,
    // а notifications без data.userId обработать его не может и отправляет в events.dead
    [Fact]
    public async Task NotificationsConsumer_EventWithoutRequiredData_GoesToDeadLetterQueue()
    {
        var companyId = Guid.NewGuid();
        var marker = Guid.NewGuid().ToString();

        await PublishRawAsync("user.registered", JsonSerializer.Serialize(new
        {
            eventId = Guid.NewGuid(), type = "user.registered", occurredAt = 1790000000L, companyId, actorId = Guid.NewGuid(),
            data = new { marker },
        }));

        await _db.WaitForAuditEventsAsync(companyId, "user.registered");
        await WaitForDeadLetterAsync(marker);
    }

    private async Task WaitForDeadLetterAsync(string marker)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        await using var connection = await factory.RabbitMq.CreateConnectionAsync();
        await using var channel = await connection.CreateChannelAsync();
        while (true)
        {
            var message = await channel.BasicGetAsync("events.dead", autoAck: true);
            if (message is not null && Encoding.UTF8.GetString(message.Body.Span).Contains(marker))
            {
                return;
            }

            Assert.True(DateTime.UtcNow < deadline, "Сообщение не появилось в events.dead");
            if (message is null)
            {
                await Task.Delay(100);
            }
        }
    }

    private static async Task WaitUntil(Func<Task<bool>> condition, string failure)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (!await condition())
        {
            Assert.True(DateTime.UtcNow < deadline, failure);
            await Task.Delay(100);
        }
    }

    // Действие, которое точно создаёт событие, — после него все ранее опубликованные события уже записаны
    private async Task Barrier(TestUser owner)
    {
        var barrierTool = await _client.CreateToolAsync(owner, "Барьер");
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (!(await _db.FindAuditEventsAsync(owner.CompanyId, "tool.created"))
                   .Any(r => r.Data.GetProperty("toolId").GetGuid() == barrierTool))
        {
            Assert.True(DateTime.UtcNow < deadline, "Событие-барьер не появилось в audit_events");
            await Task.Delay(100);
        }
    }

    private async Task PublishRawAsync(string routingKey, string body)
    {
        await using var connection = await factory.RabbitMq.CreateConnectionAsync();
        await using var channel = await connection.CreateChannelAsync();
        await channel.BasicPublishAsync("accountthis.events", routingKey, Encoding.UTF8.GetBytes(body));
    }
}
