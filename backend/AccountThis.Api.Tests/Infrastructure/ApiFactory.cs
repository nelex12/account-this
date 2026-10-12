using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;

namespace AccountThis.Api.Tests.Infrastructure;

// Поднимает приложение целиком (все middleware, контроллеры, сервисы) поверх чистой PostgreSQL в Docker.
// Контейнер один на весь прогон (коллекция "Api"). Схему создают миграции приложения при старте, как в docker-compose.
// Нужен запущенный Docker Desktop.
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("accountthis_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    // Прямой доступ к БД из тестов: подготовить состояние, которое ещё не умеет выставлять API, и проверить результат
    public TestDb Db => new(_postgres.GetConnectionString());

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Запуск приложения применяет миграции: до первого теста схема уже есть, даже если тест начинает с TestDb
        _ = Services;
    }

    // Строка подключения к другой базе того же контейнера (для тестов миграций на отдельной базе)
    public string ConnectionStringFor(string database) =>
        new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = database }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Не Development: иначе Program.cs подхватит настоящий .env из корня репозитория
        builder.UseEnvironment("Testing");

        // UseSetting, а не ConfigureAppConfiguration: Program.cs читает конфигурацию ещё до builder.Build()
        builder.UseSetting("POSTGRES_HOST", _postgres.Hostname);
        builder.UseSetting("POSTGRES_PORT", _postgres.GetMappedPublicPort(5432).ToString());
        builder.UseSetting("POSTGRES_DB", "accountthis_test");
        builder.UseSetting("POSTGRES_USER", "test");
        builder.UseSetting("POSTGRES_PASSWORD", "test");
        builder.UseSetting("SERVER_SIGNING_KEY", TestKeys.ServerPrivateKey);
        builder.UseSetting("JWT_SIGNING_KEY", TestKeys.JwtSigningKey);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await base.DisposeAsync();
    }
}

[CollectionDefinition("Api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
