using AccountThis.Worker;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;

namespace AccountThis.Api.Tests.Infrastructure;

public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("accountthis_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private readonly RabbitMqContainer _rabbitMq = new RabbitMqBuilder("rabbitmq:4")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private IHost? _worker;

    public TestDb Db => new(_postgres.GetConnectionString());

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _rabbitMq.StartAsync());

        _ = Services;

        var worker = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = "Testing" });
        worker.Configuration.AddInMemoryCollection(Settings);
        worker.Services.AddAccountThisWorker(worker.Configuration);
        _worker = worker.Build();
        await _worker.StartAsync();
    }

    // Общие настройки API и Worker
    private Dictionary<string, string?> Settings => new()
    {
        ["POSTGRES_HOST"] = _postgres.Hostname,
        ["POSTGRES_PORT"] = _postgres.GetMappedPublicPort(5432).ToString(),
        ["POSTGRES_DB"] = "accountthis_test",
        ["POSTGRES_USER"] = "test",
        ["POSTGRES_PASSWORD"] = "test",
        ["RABBITMQ_HOST"] = _rabbitMq.Hostname,
        ["RABBITMQ_PORT"] = _rabbitMq.GetMappedPublicPort(5672).ToString(),
        ["RABBITMQ_USER"] = "test",
        ["RABBITMQ_PASSWORD"] = "test",
    };

    public RabbitMQ.Client.ConnectionFactory RabbitMq => new()
    {
        HostName = _rabbitMq.Hostname,
        Port = _rabbitMq.GetMappedPublicPort(5672),
        UserName = "test",
        Password = "test",
    };

    public string ConnectionStringFor(string database) =>
        new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = database }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        foreach (var (key, value) in Settings)
        {
            builder.UseSetting(key, value);
        }

        builder.UseSetting("SERVER_SIGNING_KEY", TestKeys.ServerPrivateKey);
        builder.UseSetting("JWT_SIGNING_KEY", TestKeys.JwtSigningKey);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        if (_worker is not null)
        {
            await _worker.StopAsync();
            _worker.Dispose();
        }

        await base.DisposeAsync();
        await _rabbitMq.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition("Api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
