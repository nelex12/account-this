using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Tests.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using NSec.Cryptography;

namespace AccountThis.Api.Tests.Api;

[Collection("Api")]
public class WorkerCertTests(ApiFactory factory)
{
    private const string Url = "/api/auth/worker-cert";

    private readonly HttpClient _client = factory.CreateClient();
    private readonly TestDb _db = factory.Db;

    private readonly SignatureService _signatures = new(TestKeys.Configuration());

    [Fact]
    public async Task ApprovedWorker_GetsCertificateWithTokenFields()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true, fullName: "Кузнецов Кузьма Кузьмич");

        var before = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var response = await GetCert(worker);
        var after = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cert = await response.Content.ReadFromJsonAsync<WorkerCertificate>();
        Assert.NotNull(cert);

        using var token = DecodeToken(cert.Token);
        var root = token.RootElement;
        Assert.Equal(worker.Id.ToString("D"), root.GetProperty("workerId").GetString());
        Assert.Equal("Кузнецов Кузьма Кузьмич", root.GetProperty("fio").GetString());

        var issuedAt = root.GetProperty("issuedAt").GetInt64();
        Assert.InRange(issuedAt, before, after);
        Assert.Equal(issuedAt + 12 * 60 * 60, root.GetProperty("expiresAt").GetInt64());
        Assert.InRange(cert.ServerTime, before, after);
    }

    [Fact]
    public async Task Token_IsJsonWithExactlyContractFieldNames()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true);

        var cert = await ReadCert(await GetCert(worker));

        using var token = DecodeToken(cert.Token);
        var names = token.RootElement.EnumerateObject().Select(p => p.Name).Order().ToArray();
        Assert.Equal(["expiresAt", "fio", "issuedAt", "workerId", "workerPublicKey"], names);
    }

    [Fact]
    public async Task ServerSignature_IsValidOverPrefixedToken()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true);

        var cert = await ReadCert(await GetCert(worker));

        Assert.True(_signatures.Verify(TestKeys.ServerPublicKey, "AT1-TOKEN." + cert.Token, cert.ServerSignature));
        Assert.False(_signatures.Verify(TestKeys.ServerPublicKey, cert.Token, cert.ServerSignature));
    }

    [Fact]
    public async Task TemporaryPrivateKey_MatchesWorkerPublicKey()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true);

        var cert = await ReadCert(await GetCert(worker));

        using var token = DecodeToken(cert.Token);
        var seed = Base64UrlEncoder.DecodeBytes(cert.TemporaryPrivateKey);
        Assert.Equal(32, seed.Length);
        using var key = Key.Import(SignatureAlgorithm.Ed25519, seed, KeyBlobFormat.RawPrivateKey);
        var derivedPublicKey = Base64UrlEncoder.Encode(key.Export(KeyBlobFormat.RawPublicKey));
        Assert.Equal(derivedPublicKey, token.RootElement.GetProperty("workerPublicKey").GetString());
    }

    [Fact]
    public async Task EachRequest_IssuesNewKeyPair()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true);

        var first = await ReadCert(await GetCert(worker));
        var second = await ReadCert(await GetCert(worker));

        Assert.NotEqual(first.TemporaryPrivateKey, second.TemporaryPrivateKey);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task NotApprovedOrDeactivated_Returns403WithProblemDetails(bool isApproved, bool isActive)
    {
        var worker = await CreateWorker(isApproved, isActive);

        var response = await GetCert(worker);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("detail").GetString()));
    }

    [Fact]
    public async Task FiredAfterTokenWasIssued_Returns403()
    {
        var worker = await CreateWorker(isApproved: true, isActive: true);
        var jwt = Jwt(worker);
        await _db.SetUserFlagsAsync(worker.Id, isApproved: true, isActive: false);

        var response = await GetCert(jwt);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<UserRow> CreateWorker(bool isApproved, bool isActive, string fullName = "Иванов Иван Иванович")
    {
        var companyId = await _db.CreateCompanyAsync();
        var phone = TestDb.UniquePhone();
        await _client.RegisterEmployeeAsync(UserRole.Worker, companyId, phone, fullName).EnsureCreated();
        var user = (await _db.FindUserAsync(phone))!;
        await _db.SetUserFlagsAsync(user.Id, isApproved, isActive);
        return user;
    }

    private static string Jwt(UserRow worker) => TestTokens.Create(UserRole.Worker, worker.Id, worker.CompanyId);

    private Task<HttpResponseMessage> GetCert(UserRow worker) => GetCert(Jwt(worker));

    private Task<HttpResponseMessage> GetCert(string jwt)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, Url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return _client.SendAsync(request);
    }

    private static async Task<WorkerCertificate> ReadCert(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cert = await response.Content.ReadFromJsonAsync<WorkerCertificate>();
        Assert.NotNull(cert);
        return cert;
    }

    private static JsonDocument DecodeToken(string token) =>
        JsonDocument.Parse(Encoding.UTF8.GetString(Base64UrlEncoder.DecodeBytes(token)));
}
