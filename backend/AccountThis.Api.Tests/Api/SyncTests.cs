using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// POST /api/sync (роль Issuer). Каждая запись сохраняется с флагом по первой непройденной проверке
// (порядок — ValidationFlag в api.yaml); строка не по формату AT1 — 400 для всего запроса, ничего не сохраняется.
// QR собираются в тестах (QrBuilder) ключом сервера из TestKeys — независимо от /api/auth/worker-cert.
[Collection("Api")]
public class SyncTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    private const string OtherServerKey = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

    [Fact]
    public async Task ValidTake_IsSavedAsValidAndMakesWorkerTheHolder()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id, company.Worker.FullName);
        var timestamp = QrBuilder.Now - 10;

        var results = await Sync(company.Issuer, (qr.Qr(RentalAction.TAKE, company.ToolId, timestamp), timestamp + 2));

        var result = Assert.Single(results);
        Assert.Equal("VALID", result.GetProperty("validationFlag").GetString());
        Assert.True(result.GetProperty("logId").GetInt32() > 0);

        var tool = await GetTool(company.Owner, company.ToolId);
        Assert.Equal(company.Worker.Id, tool.GetProperty("holderId").GetGuid());
        Assert.Equal(company.Worker.FullName, tool.GetProperty("holderName").GetString());
        Assert.Equal(timestamp, tool.GetProperty("heldSince").GetInt64());
    }

    [Fact]
    public async Task ValidGive_AfterTake_ReturnsToolToIssuer()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        await Sync(company.Issuer,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 30), now - 30),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 5), now - 5));

        var tool = await GetTool(company.Owner, company.ToolId);
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("holderId").ValueKind);
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("holderName").ValueKind);
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("heldSince").ValueKind);
    }

    // Держатель — по последней по времени операции, а не по порядку синхронизации
    [Fact]
    public async Task LateSyncedOlderTake_DoesNotOverrideNewerGive()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        await Sync(company.Issuer, (qr.Qr(RentalAction.GIVE, company.ToolId, now - 5), now - 5));
        await Sync(company.Issuer, (qr.Qr(RentalAction.TAKE, company.ToolId, now - 30), now - 30));

        Assert.Equal(JsonValueKind.Null, (await GetTool(company.Owner, company.ToolId)).GetProperty("holderId").ValueKind);
    }

    // Ответ возвращается для каждой записи в порядке запроса
    [Fact]
    public async Task Results_AreInRequestOrder()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        var results = await Sync(company.Issuer,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 100), now - 100),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 90), now - 10),
            (qr.Qr(RentalAction.TAKE, Guid.NewGuid(), now - 50), now - 50));

        Assert.Equal(new[] { "VALID", "TIME_DRIFT", "UNKNOWN_TOOL" }, results.Select(r => r.GetProperty("validationFlag").GetString()));
        Assert.Equal(3, results.Select(r => r.GetProperty("logId").GetInt32()).Distinct().Count());
    }

    [Fact]
    public async Task EmptyArray_Returns200WithEmptyArray()
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Issuer, HttpMethod.Post, "/api/sync", Array.Empty<object>());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await response.ReadJsonAsync()).GetArrayLength());
    }

    [Theory]
    [InlineData(UserRole.Worker)]
    [InlineData(UserRole.Owner)]
    public async Task NotIssuer_Returns403(UserRole role)
    {
        var company = await CreateCompany();
        var user = role == UserRole.Owner ? company.Owner : company.Worker;

        var response = await _client.SendAs(user, HttpMethod.Post, "/api/sync", Array.Empty<object>());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---------- Флаги ----------

    // Подпись сервера неверна — привязок нет: поддельный токен не приписывает операцию сотруднику
    [Fact]
    public async Task ForgedToken_IsInvalidServerSig_WithoutBindings()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id, "Поддельный Сотрудник", serverPrivateKey: OtherServerKey);

        var entry = await SyncOneAndReadLog(company, qr.Qr(RentalAction.TAKE, company.ToolId, toolName: "Заявленная дрель"));

        Assert.Equal("INVALID_SERVER_SIG", entry.GetProperty("validationFlag").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("workerId").ValueKind);
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("toolId").ValueKind);
        // Имена — из непроверенных значений строки QR
        Assert.Equal("Поддельный Сотрудник", entry.GetProperty("workerName").GetString());
        Assert.Equal("Заявленная дрель", entry.GetProperty("toolName").GetString());
        // Держателя не появилось
        Assert.Equal(JsonValueKind.Null, (await GetTool(company.Owner, company.ToolId)).GetProperty("holderId").ValueKind);
    }

    // Подпись работника неверна — сотрудник известен (токен подлинный), инструмент — нет
    [Fact]
    public async Task ForeignOperationSignature_IsInvalidWorkerSig_WithWorkerOnly()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);

        var entry = await SyncOneAndReadLog(company, qr.Qr(RentalAction.TAKE, company.ToolId, signWithForeignKey: true));

        Assert.Equal("INVALID_WORKER_SIG", entry.GetProperty("validationFlag").GetString());
        Assert.Equal(company.Worker.Id, entry.GetProperty("workerId").GetGuid());
        Assert.Equal(company.Worker.FullName, entry.GetProperty("workerName").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("toolId").ValueKind);
    }

    // Подпись над изменённой строкой op не сходится
    [Fact]
    public async Task TamperedOperation_IsInvalidWorkerSig()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var original = qr.Qr(RentalAction.TAKE, company.ToolId).Split('.');
        var otherOp = qr.Qr(RentalAction.GIVE, company.ToolId).Split('.')[3];
        var tampered = string.Join('.', original[0], original[1], original[2], otherOp, original[4]);

        var entry = await SyncOneAndReadLog(company, tampered);

        Assert.Equal("INVALID_WORKER_SIG", entry.GetProperty("validationFlag").GetString());
    }

    [Theory]
    [InlineData(-13 * 3600, -3600)] // сертификат истёк час назад
    [InlineData(3600, 13 * 3600)]   // сертификат начнёт действовать через час
    public async Task TimestampOutsideCertificate_IsExpiredToken(long issuedShift, long expiresShift)
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id, issuedAt: now + issuedShift, expiresAt: now + expiresShift);

        var flag = await SyncOneFlag(company, qr.Qr(RentalAction.TAKE, company.ToolId, now), now);

        Assert.Equal("EXPIRED_TOKEN", flag);
    }

    // Границы сертификата включительно: [issuedAt, expiresAt]
    [Fact]
    public async Task TimestampAtCertificateBounds_IsValid()
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id, issuedAt: now - 100, expiresAt: now - 50);

        var results = await Sync(company.Issuer,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 100), now - 100),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 50), now - 50));

        Assert.All(results, r => Assert.Equal("VALID", r.GetProperty("validationFlag").GetString()));
    }

    [Theory]
    [InlineData(-61, 0, "TIME_DRIFT")]   // отсканирован через 61 с после создания
    [InlineData(61, 0, "TIME_DRIFT")]    // отсканирован раньше, чем создан
    [InlineData(-60, 0, "VALID")]        // ровно 60 с — допустимо
    [InlineData(400, 400, "TIME_DRIFT")] // и timestamp, и scannedAt позже сервера больше чем на 5 минут
    [InlineData(0, 400, "TIME_DRIFT")]   // scannedAt в будущем (и расхождение)
    [InlineData(240, 240, "VALID")]      // 4 минуты в будущем — в пределах допуска
    public async Task TimeChecks(long timestampShift, long scannedShift, string expected)
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id, issuedAt: now - 3600, expiresAt: now + 3600);

        var flag = await SyncOneFlag(company, qr.Qr(RentalAction.TAKE, company.ToolId, now + timestampShift), now + scannedShift);

        Assert.Equal(expected, flag);
    }

    // Сотрудник другой компании неотличим от несуществующего; привязки к нему нет, инструмент свой — привязан
    [Fact]
    public async Task WorkerOfAnotherCompany_IsUnknownWorker()
    {
        var company = await CreateCompany();
        var stranger = await CreateCompany();
        using var qr = QrBuilder.Forge(stranger.Worker.Id, "Чужой Сотрудник");

        var entry = await SyncOneAndReadLog(company, qr.Qr(RentalAction.TAKE, company.ToolId));

        Assert.Equal("UNKNOWN_WORKER", entry.GetProperty("validationFlag").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("workerId").ValueKind);
        Assert.Equal("Чужой Сотрудник", entry.GetProperty("workerName").GetString());
        Assert.Equal(company.ToolId, entry.GetProperty("toolId").GetGuid());
    }

    [Fact]
    public async Task NonexistentWorker_IsUnknownWorker()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(Guid.NewGuid());

        Assert.Equal("UNKNOWN_WORKER", await SyncOneFlag(company, qr.Qr(RentalAction.TAKE, company.ToolId)));
    }

    // Операция не раньше момента увольнения — WORKER_DEACTIVATED; до увольнения — VALID
    [Fact]
    public async Task FiredWorker_OperationsAfterDeactivationAreFlagged()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var deactivate = await _client.SendAs(company.Owner, HttpMethod.Delete, $"/api/users/{company.Worker.Id}");
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);
        var deactivatedAt = (await _db.FindDeactivatedAtAsync(company.Worker.Id))!.Value;

        var results = await Sync(company.Issuer,
            (qr.Qr(RentalAction.TAKE, company.ToolId, deactivatedAt - 30), deactivatedAt - 25),
            (qr.Qr(RentalAction.GIVE, company.ToolId, deactivatedAt), deactivatedAt + 1));

        Assert.Equal(new[] { "VALID", "WORKER_DEACTIVATED" }, results.Select(r => r.GetProperty("validationFlag").GetString()));
    }

    [Fact]
    public async Task ToolOfAnotherCompany_IsUnknownTool_WithoutToolBinding()
    {
        var company = await CreateCompany();
        var stranger = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);

        var entry = await SyncOneAndReadLog(company, qr.Qr(RentalAction.TAKE, stranger.ToolId, toolName: "Чужая дрель"));

        Assert.Equal("UNKNOWN_TOOL", entry.GetProperty("validationFlag").GetString());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("toolId").ValueKind);
        Assert.Equal("Чужая дрель", entry.GetProperty("toolName").GetString());
        Assert.Equal(company.Worker.Id, entry.GetProperty("workerId").GetGuid());
        // Чужой инструмент не получил держателя
        Assert.Equal(JsonValueKind.Null, (await GetTool(stranger.Owner, stranger.ToolId)).GetProperty("holderId").ValueKind);
    }

    // Один QR отсканирован дважды (разное время сканирования) — вторая запись DUPLICATE
    [Fact]
    public async Task SameQrScannedAgain_IsDuplicate()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        var code = qr.Qr(RentalAction.TAKE, company.ToolId, now - 20);

        var first = await Sync(company.Issuer, (code, now - 20));
        var second = await Sync(company.Issuer, (code, now - 19), (code, now - 18));

        Assert.Equal("VALID", first.Single().GetProperty("validationFlag").GetString());
        Assert.All(second, r => Assert.Equal("DUPLICATE", r.GetProperty("validationFlag").GetString()));
    }

    // Записи с другими флагами не в счёт: испорченная копия, отправленная первой, не делает честную запись дублем
    [Fact]
    public async Task NonValidCopyFirst_DoesNotMakeLaterRecordDuplicate()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        var code = qr.Qr(RentalAction.TAKE, company.ToolId, now - 120);

        var results = await Sync(company.Issuer, (code, now), (code, now - 119));

        Assert.Equal(new[] { "TIME_DRIFT", "VALID" }, results.Select(r => r.GetProperty("validationFlag").GetString()));
    }

    // ---------- Идемпотентность ----------

    // Та же запись (issuer, scannedAt, qr) повторно не создаётся: возвращается существующая
    [Fact]
    public async Task ResentRecord_ReturnsExistingLogWithoutDuplicating()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        var record = (qr.Qr(RentalAction.TAKE, company.ToolId, now - 5), now - 3);

        var first = (await Sync(company.Issuer, record)).Single();
        var second = (await Sync(company.Issuer, record, record)).ToArray();

        Assert.All(second, r =>
        {
            Assert.Equal(first.GetProperty("logId").GetInt32(), r.GetProperty("logId").GetInt32());
            Assert.Equal("VALID", r.GetProperty("validationFlag").GetString());
        });
        Assert.Equal(1, await _db.CountRentalLogsAsync(company.Owner.CompanyId));
    }

    // Другой завхоз той же компании, отправивший тот же QR, — не повтор, а DUPLICATE
    [Fact]
    public async Task SameRecordFromAnotherIssuer_IsDuplicate()
    {
        var company = await CreateCompany();
        var secondIssuer = await factory.CreateEmployeeAsync(_client, company.Owner, UserRole.Issuer);
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        var record = (qr.Qr(RentalAction.TAKE, company.ToolId, now - 5), now - 3);

        await Sync(company.Issuer, record);
        var results = await Sync(secondIssuer, record);

        Assert.Equal("DUPLICATE", results.Single().GetProperty("validationFlag").GetString());
        Assert.Equal(2, await _db.CountRentalLogsAsync(company.Owner.CompanyId));
    }

    // Параллельные запросы с одним QR: VALID-запись ровно одна
    [Fact]
    public async Task ConcurrentSyncOfSameQr_ProducesSingleValid()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        var code = qr.Qr(RentalAction.TAKE, company.ToolId, now - 10);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => Sync(company.Issuer, (code, now - 10 + i))));

        var flags = responses.Select(r => r.Single().GetProperty("validationFlag").GetString()).ToList();
        Assert.Equal(1, flags.Count(f => f == "VALID"));
        Assert.Equal(4, flags.Count(f => f == "DUPLICATE"));
    }

    // ---------- Формат ----------

    // Строка не по формату — 400 с номерами таких записей, ничего не сохраняется
    [Fact]
    public async Task MalformedQr_RejectsWholeRequestWithIndexes()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        var response = await PostSync(company.Issuer,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now), now),
            ("AT1.not.enough", now),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now), now),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now).Replace("AT1.", "AT2."), now));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var errors = (await response.ReadJsonAsync()).GetProperty("errors");
        Assert.Equal(new[] { "[1].qr", "[3].qr" }, errors.EnumerateObject().Select(e => e.Name).Order());
        Assert.StartsWith("Строка не соответствует формату AT1", errors.GetProperty("[1].qr")[0].GetString());
        Assert.Equal(0, await _db.CountRentalLogsAsync(company.Owner.CompanyId));
    }

    [Fact]
    public async Task MissingFields_Return400()
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Issuer, HttpMethod.Post, "/api/sync", new object[] { new { qr = "AT1.a.b.c.d" } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BodyNotArray_Returns400()
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Issuer, HttpMethod.Post, "/api/sync", new { qr = "x", scannedAt = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------- Состояние инструмента ----------

    // VALID обновляет condition, если операция не раньше последнего изменения состояния
    [Fact]
    public async Task ValidOperation_UpdatesToolCondition_OnlyIfNotOlder()
    {
        var company = await CreateCompany();
        await _db.BackdateToolConditionAsync(company.ToolId, TimeSpan.FromHours(1));
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        await Sync(company.Issuer, (qr.Qr(RentalAction.GIVE, company.ToolId, now - 10, ToolCondition.Damaged), now - 10));
        Assert.Equal(("Damaged", now - 10), await _db.FindToolConditionAsync(company.ToolId));

        // Более старая операция, синхронизированная позже, состояние не перезаписывает
        await Sync(company.Issuer, (qr.Qr(RentalAction.TAKE, company.ToolId, now - 40, ToolCondition.Good), now - 40));
        Assert.Equal("Damaged", (await _db.FindToolConditionAsync(company.ToolId)).Condition);
    }

    // Ручное изменение через PATCH (время сервера) не перезаписывается более ранней операцией
    [Fact]
    public async Task ManualPatch_IsNotOverriddenByEarlierOperation()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;
        await _db.BackdateToolConditionAsync(company.ToolId, TimeSpan.FromHours(1));
        await _client.SendAs(company.Owner, HttpMethod.Patch, $"/api/tools/{company.ToolId}", new { condition = "Broken" });

        await Sync(company.Issuer, (qr.Qr(RentalAction.GIVE, company.ToolId, now - 10, ToolCondition.Good), now - 10));

        Assert.Equal("Broken", (await _db.FindToolConditionAsync(company.ToolId)).Condition);
    }

    [Fact]
    public async Task NotValidOperation_DoesNotChangeCondition()
    {
        var company = await CreateCompany();
        await _db.BackdateToolConditionAsync(company.ToolId, TimeSpan.FromHours(1));
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var now = QrBuilder.Now;

        await Sync(company.Issuer, (qr.Qr(RentalAction.GIVE, company.ToolId, now - 100, ToolCondition.Broken), now));

        Assert.Equal("Good", (await _db.FindToolConditionAsync(company.ToolId)).Condition);
    }

    // ---------- Сквозной сценарий ----------

    // Настоящий сертификат из /api/auth/worker-cert → QR, подписанный временным ключом → VALID
    [Fact]
    public async Task EndToEnd_CertificateFromServer_ProducesValidRecord()
    {
        var company = await CreateCompany();
        var certResponse = await _client.SendAs(company.Worker, HttpMethod.Get, "/api/auth/worker-cert");
        Assert.Equal(HttpStatusCode.OK, certResponse.StatusCode);
        var certificate = (await certResponse.Content.ReadFromJsonAsync<WorkerCertificate>())!;
        using var qr = QrBuilder.FromCertificate(certificate);
        var timestamp = certificate.ServerTime + 1;

        var entry = await SyncOneAndReadLog(company, qr.Qr(RentalAction.TAKE, company.ToolId, timestamp), timestamp + 1);

        Assert.Equal("VALID", entry.GetProperty("validationFlag").GetString());
        Assert.Equal(company.Worker.Id, entry.GetProperty("workerId").GetGuid());
        Assert.Equal(company.ToolId, entry.GetProperty("toolId").GetGuid());
        Assert.Equal(company.Issuer.Id, entry.GetProperty("issuerId").GetGuid());
    }

    // ---------- Подготовка ----------

    private sealed record Company(TestUser Owner, TestUser Issuer, TestUser Worker, Guid ToolId);

    private async Task<Company> CreateCompany()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer, "Завхозов Завхоз");
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, "Работников Работник");
        var toolId = await _client.CreateToolAsync(owner);
        return new Company(owner, issuer, worker, toolId);
    }

    private Task<HttpResponseMessage> PostSync(TestUser issuer, params (string Qr, long ScannedAt)[] records) =>
        _client.SendAs(issuer, HttpMethod.Post, "/api/sync", records.Select(r => new { qr = r.Qr, scannedAt = r.ScannedAt }).ToArray());

    private async Task<List<JsonElement>> Sync(TestUser issuer, params (string Qr, long ScannedAt)[] records)
    {
        var response = await PostSync(issuer, records);
        Assert.True(response.StatusCode == HttpStatusCode.OK,
            $"/api/sync вернул {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        var results = (await response.ReadJsonAsync()).EnumerateArray().ToList();
        Assert.Equal(records.Length, results.Count);
        return results;
    }

    private async Task<string> SyncOneFlag(Company company, string qr, long? scannedAt = null)
    {
        var results = await Sync(company.Issuer, (qr, scannedAt ?? QrBuilder.Now));
        return results.Single().GetProperty("validationFlag").GetString()!;
    }

    // Синхронизация одной записи и её строка из GET /api/logs
    private async Task<JsonElement> SyncOneAndReadLog(Company company, string qr, long? scannedAt = null)
    {
        var logId = (await Sync(company.Issuer, (qr, scannedAt ?? QrBuilder.Now))).Single().GetProperty("logId").GetInt32();
        var logs = await (await _client.SendAs(company.Owner, HttpMethod.Get, "/api/logs")).ReadJsonAsync();
        return logs.EnumerateArray().Single(e => e.GetProperty("id").GetInt32() == logId);
    }

    private async Task<JsonElement> GetTool(TestUser user, Guid id) =>
        await (await _client.SendAs(user, HttpMethod.Get, $"/api/tools/{id}")).ReadJsonAsync();
}
