using System.Net;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Tests.Infrastructure;

namespace AccountThis.Api.Tests.Api;

// /api/tools (роли Issuer, Owner; списание — только Owner). У каждой компании свой реестр:
// инструмент другой компании неотличим от несуществующего — 404.
[Collection("Api")]
public class ToolsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    [Theory]
    [InlineData(UserRole.Owner)]
    [InlineData(UserRole.Issuer)]
    public async Task Create_Returns201WithToolAndLocation(UserRole role)
    {
        var user = await CreateUser(role);

        var response = await _client.SendAs(user, HttpMethod.Post, "/api/tools", new { name = "Перфоратор Makita" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var tool = await response.ReadJsonAsync();
        var id = tool.GetProperty("id").GetGuid();
        Assert.Equal($"/api/tools/{id}", response.Headers.Location?.AbsolutePath);
        Assert.Equal("Перфоратор Makita", tool.GetProperty("name").GetString());
        Assert.Equal("Good", tool.GetProperty("condition").GetString());
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("comment").ValueKind);
        Assert.True(tool.GetProperty("isActive").GetBoolean());
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("holderId").ValueKind);
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("holderName").ValueKind);
        Assert.Equal(JsonValueKind.Null, tool.GetProperty("heldSince").ValueKind);
    }

    [Fact]
    public async Task Tool_HasExactlyContractFields()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);

        var tool = await (await _client.SendAs(owner, HttpMethod.Get, $"/api/tools/{id}")).ReadJsonAsync();

        Assert.Equal(
            new[] { "comment", "condition", "heldSince", "holderId", "holderName", "id", "isActive", "name" },
            tool.EnumerateObject().Select(p => p.Name).Order());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Create_WithoutName_Returns400(string? name)
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Post, "/api/tools", new { name });

        await AssertValidationError(response, "name");
    }

    // Название попадает в QR сотрудника, поэтому не длиннее 100 символов
    [Fact]
    public async Task Create_NameLongerThan100_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Post, "/api/tools", new { name = new string('a', 101) });

        await AssertValidationError(response, "name");
    }

    // PostgreSQL не хранит символ U+0000: такая строка — 400 на валидации, а не 500 на INSERT
    [Fact]
    public async Task Create_NameWithNullCharacter_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Post, "/api/tools", new { name = "Дрель\u0000" });

        await AssertValidationError(response, "name");
    }

    [Fact]
    public async Task Create_ByWorker_Returns403()
    {
        var worker = await CreateUser(UserRole.Worker);

        var response = await _client.SendAs(worker, HttpMethod.Post, "/api/tools", new { name = "Дрель" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTools_ReturnsOnlyActiveToolsOfOwnCompany()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var issuer = await factory.CreateEmployeeAsync(_client, owner, UserRole.Issuer);
        var drill = await _client.CreateToolAsync(owner, "Дрель");
        var saw = await _client.CreateToolAsync(issuer, "Пила");
        var writtenOff = await _client.CreateToolAsync(owner, "Старый лобзик");
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{writtenOff}");
        var stranger = await factory.CreateOwnerAsync(_client);
        await _client.CreateToolAsync(stranger, "Чужая дрель");

        var response = await _client.SendAs(issuer, HttpMethod.Get, "/api/tools");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var ids = (await response.ReadJsonAsync()).EnumerateArray().Select(t => t.GetProperty("id").GetGuid());
        Assert.Equal(new[] { drill, saw }.Order(), ids.Order());
    }

    [Fact]
    public async Task GetTool_OfAnotherCompany_Returns404()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var foreignTool = await _client.CreateToolAsync(await factory.CreateOwnerAsync(_client));

        var response = await _client.SendAs(owner, HttpMethod.Get, $"/api/tools/{foreignTool}");

        await AssertProblem(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetTool_NotUuid_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);

        var response = await _client.SendAs(owner, HttpMethod.Get, "/api/tools/not-a-uuid");

        await AssertValidationError(response, "id");
    }

    [Fact]
    public async Task Patch_ChangesConditionAndCommentAndConditionTime()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _db.BackdateToolConditionAsync(id, TimeSpan.FromHours(1));

        var before = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}",
            new { condition = "Damaged", comment = "Трещина на корпусе" });
        var after = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var tool = await GetTool(owner, id);
        Assert.Equal("Damaged", tool.GetProperty("condition").GetString());
        Assert.Equal("Трещина на корпусе", tool.GetProperty("comment").GetString());
        Assert.InRange((await _db.FindToolConditionAsync(id)).ConditionUpdatedAt, before, after);
    }

    // Не переданное поле не меняется; comment = "" очищает комментарий
    [Fact]
    public async Task Patch_PartialUpdates()
    {
        var issuer = await CreateUser(UserRole.Issuer);
        var id = await _client.CreateToolAsync(issuer);
        await _client.SendAs(issuer, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Broken", comment = "Сгорел мотор" });

        await _client.SendAs(issuer, HttpMethod.Patch, $"/api/tools/{id}", new { comment = "Отдан в ремонт" });
        var afterComment = await GetTool(issuer, id);
        Assert.Equal("Broken", afterComment.GetProperty("condition").GetString());
        Assert.Equal("Отдан в ремонт", afterComment.GetProperty("comment").GetString());

        await _client.SendAs(issuer, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Good", comment = (string?)null });
        var afterCondition = await GetTool(issuer, id);
        Assert.Equal("Good", afterCondition.GetProperty("condition").GetString());
        Assert.Equal("Отдан в ремонт", afterCondition.GetProperty("comment").GetString());

        await _client.SendAs(issuer, HttpMethod.Patch, $"/api/tools/{id}", new { comment = "" });
        Assert.Equal(JsonValueKind.Null, (await GetTool(issuer, id)).GetProperty("comment").ValueKind);
    }

    // Комментарий без condition не сдвигает время изменения состояния
    [Fact]
    public async Task Patch_CommentOnly_KeepsConditionTime()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _db.BackdateToolConditionAsync(id, TimeSpan.FromHours(1));
        var original = (await _db.FindToolConditionAsync(id)).ConditionUpdatedAt;

        await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { comment = "Проверен" });

        Assert.Equal(original, (await _db.FindToolConditionAsync(id)).ConditionUpdatedAt);
    }

    [Fact]
    public async Task Patch_InvalidCondition_Returns400()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Lost" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // condition — строго имя значения (api.yaml, «Значения в запросах»): число и другой регистр — 400.
    // Раньше 0 молча становился Good, поэтому исходное состояние — Broken
    [Theory]
    [InlineData(0)]
    [InlineData("0")]
    [InlineData("good")]
    public async Task Patch_ConditionNotExactName_Returns400AndDoesNotChange(object condition)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Broken" });

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { condition });

        await AssertValidationError(response, "$.condition");
        Assert.Equal("Broken", (await GetTool(owner, id)).GetProperty("condition").GetString());
    }

    // condition: null — поле не меняется, как не переданное
    [Fact]
    public async Task Patch_NullCondition_KeepsCondition()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Damaged" });

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}",
            new { condition = (string?)null, comment = "Проверен" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var tool = await GetTool(owner, id);
        Assert.Equal("Damaged", tool.GetProperty("condition").GetString());
        Assert.Equal("Проверен", tool.GetProperty("comment").GetString());
    }

    [Fact]
    public async Task Patch_CommentWithNullCharacter_Returns400AndDoesNotChange()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { comment = "Трещина\u0000" });

        await AssertValidationError(response, "comment");
        Assert.Equal(JsonValueKind.Null, (await GetTool(owner, id)).GetProperty("comment").ValueKind);
    }

    [Fact]
    public async Task Patch_ToolOfAnotherCompany_Returns404AndDoesNotChange()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var stranger = await factory.CreateOwnerAsync(_client);
        var foreignTool = await _client.CreateToolAsync(stranger);

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{foreignTool}", new { condition = "Broken" });

        await AssertProblem(response, HttpStatusCode.NotFound);
        Assert.Equal("Good", (await _db.FindToolConditionAsync(foreignTool)).Condition);
    }

    // Разрешено и для списанного инструмента, is_active не меняется
    [Fact]
    public async Task Patch_WrittenOffTool_IsAllowed()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{id}");

        var response = await _client.SendAs(owner, HttpMethod.Patch, $"/api/tools/{id}", new { condition = "Broken" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var tool = await GetTool(owner, id);
        Assert.Equal("Broken", tool.GetProperty("condition").GetString());
        Assert.False(tool.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Delete_WritesOffButToolStaysAvailableById()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await GetTool(owner, id)).GetProperty("isActive").GetBoolean());
        var list = await (await _client.SendAs(owner, HttpMethod.Get, "/api/tools")).ReadJsonAsync();
        Assert.DoesNotContain(list.EnumerateArray(), t => t.GetProperty("id").GetGuid() == id);
    }

    [Fact]
    public async Task Delete_Repeated_Returns200()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var id = await _client.CreateToolAsync(owner);
        await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{id}");

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Delete_ByIssuer_Returns403()
    {
        var issuer = await CreateUser(UserRole.Issuer);
        var id = await _client.CreateToolAsync(issuer);

        var response = await _client.SendAs(issuer, HttpMethod.Delete, $"/api/tools/{id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True((await GetTool(issuer, id)).GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Delete_ToolOfAnotherCompany_Returns404AndDoesNotWriteOff()
    {
        var owner = await factory.CreateOwnerAsync(_client);
        var stranger = await factory.CreateOwnerAsync(_client);
        var foreignTool = await _client.CreateToolAsync(stranger);

        var response = await _client.SendAs(owner, HttpMethod.Delete, $"/api/tools/{foreignTool}");

        await AssertProblem(response, HttpStatusCode.NotFound);
        Assert.True((await GetTool(stranger, foreignTool)).GetProperty("isActive").GetBoolean());
    }

    private async Task<TestUser> CreateUser(UserRole role)
    {
        var owner = await factory.CreateOwnerAsync(_client);
        return role == UserRole.Owner ? owner : await factory.CreateEmployeeAsync(_client, owner, role);
    }

    private async Task<JsonElement> GetTool(TestUser user, Guid id)
    {
        var response = await _client.SendAs(user, HttpMethod.Get, $"/api/tools/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadJsonAsync();
    }

    private static async Task AssertValidationError(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.ReadJsonAsync();
        Assert.True(body.GetProperty("errors").TryGetProperty(field, out _), $"Нет ошибки по полю {field}: {body}");
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.ReadJsonAsync();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("detail").GetString()));
    }
}
