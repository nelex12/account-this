using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// GET /api/logs (роли Issuer, Owner): журнал своей компании, новые сверху (qrTimestamp DESC, затем id DESC),
// записи со всеми флагами; фильтры action и toolId.
[Collection("Api")]
public class LogsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Entry_HasContractFieldsAndValues()
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id, company.Worker.FullName);
        await Sync(company, (qr.Qr(RentalAction.TAKE, company.ToolId, now - 10, ToolCondition.Damaged), now - 8));

        var entry = (await GetLogs(company.Owner)).Single();

        Assert.Equal(
            new[] { "action", "createdAt", "id", "issuerId", "qrTimestamp", "scannedAt", "toolCondition", "toolId", "toolName", "validationFlag", "workerId", "workerName" },
            entry.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(company.ToolId, entry.GetProperty("toolId").GetGuid());
        Assert.Equal("Дрель Bosch GSB 16 RE", entry.GetProperty("toolName").GetString());
        Assert.Equal(company.Worker.Id, entry.GetProperty("workerId").GetGuid());
        Assert.Equal(company.Worker.FullName, entry.GetProperty("workerName").GetString());
        Assert.Equal(company.Issuer.Id, entry.GetProperty("issuerId").GetGuid());
        Assert.Equal("TAKE", entry.GetProperty("action").GetString());
        Assert.Equal("Damaged", entry.GetProperty("toolCondition").GetString());
        Assert.Equal(now - 10, entry.GetProperty("qrTimestamp").GetInt64());
        Assert.Equal(now - 8, entry.GetProperty("scannedAt").GetInt64());
        Assert.Equal("VALID", entry.GetProperty("validationFlag").GetString());
        Assert.InRange(entry.GetProperty("createdAt").GetInt64(), now - 5, now + 60);
    }

    // Имя из реестра, а не из QR, когда инструмент привязан
    [Fact]
    public async Task BoundTool_NameComesFromRegistry()
    {
        var company = await CreateCompany();
        using var qr = QrBuilder.Forge(company.Worker.Id, "Имя в токене");
        await Sync(company, (qr.Qr(RentalAction.TAKE, company.ToolId, toolName: "Имя на наклейке"), QrBuilder.Now));

        var entry = (await GetLogs(company.Owner)).Single();

        Assert.Equal("Дрель Bosch GSB 16 RE", entry.GetProperty("toolName").GetString());
        Assert.Equal(company.Worker.FullName, entry.GetProperty("workerName").GetString());
    }

    // Новые сверху по времени операции, а не по порядку синхронизации; при равном времени — позже сохранённая выше
    [Fact]
    public async Task Entries_AreOrderedByQrTimestampThenIdDescending()
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id);
        var ids = await Sync(company,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 30), now - 30),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 10), now - 10),
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 50), now - 50),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 10, ToolCondition.Damaged), now - 10));

        var order = (await GetLogs(company.Issuer)).Select(e => e.GetProperty("id").GetInt32());

        Assert.Equal(new[] { ids[3], ids[1], ids[0], ids[2] }, order);
    }

    // Все флаги, не только VALID
    [Fact]
    public async Task Entries_IncludeAllFlags()
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id);
        await Sync(company,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 5), now - 5),
            (qr.Qr(RentalAction.TAKE, Guid.NewGuid(), now - 5), now - 5),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 200), now));

        var flags = (await GetLogs(company.Owner)).Select(e => e.GetProperty("validationFlag").GetString()).Order();

        Assert.Equal(new[] { "TIME_DRIFT", "UNKNOWN_TOOL", "VALID" }, flags);
    }

    [Fact]
    public async Task DoesNotShowOtherCompanies()
    {
        var company = await CreateCompany();
        var stranger = await CreateCompany();
        using var qr = QrBuilder.Forge(stranger.Worker.Id);
        await Sync(stranger, (qr.Qr(RentalAction.TAKE, stranger.ToolId), QrBuilder.Now));

        Assert.Empty(await GetLogs(company.Owner));
        Assert.Empty(await GetLogs(company.Issuer));
        Assert.Single(await GetLogs(stranger.Owner));
    }

    [Fact]
    public async Task FilterByAction()
    {
        var company = await CreateCompany();
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id);
        await Sync(company,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 20), now - 20),
            (qr.Qr(RentalAction.GIVE, company.ToolId, now - 10), now - 10));

        var takes = await GetLogs(company.Owner, "?action=TAKE");
        var gives = await GetLogs(company.Owner, "?action=GIVE");

        Assert.Equal("TAKE", Assert.Single(takes).GetProperty("action").GetString());
        Assert.Equal("GIVE", Assert.Single(gives).GetProperty("action").GetString());
    }

    // Записи с toolId = null в выборку по инструменту не попадают
    [Fact]
    public async Task FilterByTool()
    {
        var company = await CreateCompany();
        var otherTool = await _client.CreateToolAsync(company.Owner, "Пила");
        var now = QrBuilder.Now;
        using var qr = QrBuilder.Forge(company.Worker.Id);
        await Sync(company,
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 20), now - 20),
            (qr.Qr(RentalAction.TAKE, otherTool, now - 10), now - 10),
            (qr.Qr(RentalAction.TAKE, company.ToolId, now - 5, signWithForeignKey: true), now - 5));

        var entries = await GetLogs(company.Owner, $"?toolId={company.ToolId}");

        var entry = Assert.Single(entries);
        Assert.Equal(company.ToolId, entry.GetProperty("toolId").GetGuid());
    }

    [Theory]
    [InlineData("?action=take")]
    [InlineData("?action=0")]
    [InlineData("?action=RETURN")]
    public async Task InvalidAction_Returns400(string query)
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Owner, HttpMethod.Get, "/api/logs" + query);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("action", out _));
    }

    [Fact]
    public async Task ToolIdNotUuid_Returns400()
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Owner, HttpMethod.Get, "/api/logs?toolId=abc");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadJsonAsync()).GetProperty("errors").TryGetProperty("toolId", out _));
    }

    [Fact]
    public async Task ByWorker_Returns403()
    {
        var company = await CreateCompany();

        var response = await _client.SendAs(company.Worker, HttpMethod.Get, "/api/logs");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private sealed record Company(TestUser Owner, TestUser Issuer, TestUser Worker, Guid ToolId);

    private async Task<Company> CreateCompany()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer, "Завхозов Завхоз");
        var worker = await factory.CreateEmployeeAsync(_client, owner, UserRole.Worker, "Работников Работник");
        var toolId = await _client.CreateToolAsync(owner);
        return new Company(owner, issuer, worker, toolId);
    }

    // id сохранённых записей в порядке запроса
    private async Task<int[]> Sync(Company company, params (string Qr, long ScannedAt)[] records)
    {
        var response = await _client.SendAs(company.Issuer, HttpMethod.Post, "/api/sync",
            records.Select(r => new { qr = r.Qr, scannedAt = r.ScannedAt }).ToArray());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.ReadJsonAsync()).EnumerateArray().Select(r => r.GetProperty("logId").GetInt32()).ToArray();
    }

    private async Task<List<JsonElement>> GetLogs(TestUser user, string query = "")
    {
        var response = await _client.SendAs(user, HttpMethod.Get, "/api/logs" + query);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.ReadJsonAsync()).EnumerateArray().ToList();
    }
}
