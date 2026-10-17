using AccountThis.Worker;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;

namespace AccountThis.Api.Tests.Infrastructure;

// Поднимает систему целиком: API (все middleware, контроллеры, сервисы, отправка событий из outbox)
// и Worker (потребители очередей) поверх чистых PostgreSQL и RabbitMQ в Docker. Контейнеры одни на весь прогон (коллекция "Api"). Схему создают миграции приложения при старте, как в docker-compose.
// Нужен запущенный Docker Desktop.
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

    // Прямой доступ к БД из тестов: подготовить состояние, которое ещё не умеет выставлять API, и проверить результат
    public TestDb Db => new(_postgres.GetConnectionString());

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _rabbitMq.StartAsync());

        // Запуск приложения применяет миграции: до первого теста схема уже есть, даже если тест начинает с TestDb
        _ = Services;

        // Worker — отдельный процесс в docker-compose; здесь — отдельный хост в том же процессе, с теми же потребителями
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

    // Подключение к брокеру из тестов: опубликовать сообщение в обход API, заглянуть в очередь отказов
    public RabbitMQ.Client.ConnectionFactory RabbitMq => new()
    {
        HostName = _rabbitMq.Hostname,
        Port = _rabbitMq.GetMappedPublicPort(5672),
        UserName = "test",
        Password = "test",
    };

    // Строка подключения к другой базе того же контейнера (для тестов миграций на отдельной базе)
    public string ConnectionStringFor(string database) =>
        new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = database }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Не Development: иначе Program.cs подхватит настоящий .env из корня репозитория
        builder.UseEnvironment("Testing");

        // UseSetting, а не ConfigureAppConfiguration: Program.cs читает конфигурацию ещё до builder.Build()
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
