using AccountThis.Api.Migrations;
using AccountThis.Api.Tests.Infrastructure;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace AccountThis.Api.Tests.Api;

// Migrations/*.sql применяются при старте приложения. Каждый тест — на своей пустой базе в контейнере ApiFactory,
// чтобы не зависеть от базы, которую уже смигрировало приложение.
[Collection("Api")]
public class MigrationsTests(ApiFactory factory)
{
    [Fact]
    public async Task EmptyDatabase_CreatesSchemaAndRecordsMigrations()
    {
        await using var dataSource = await NewDatabase();

        await DatabaseMigrator.MigrateAsync(dataSource, NullLogger.Instance);

        Assert.Contains("0001_init", await AppliedVersions(dataSource));
        Assert.True(await Scalar<bool>(dataSource, "SELECT to_regclass('public.users') IS NOT NULL"));
    }

    // Повторный старт приложения ничего не применяет заново
    [Fact]
    public async Task SecondRun_AppliesNothing()
    {
        await using var dataSource = await NewDatabase();
        await DatabaseMigrator.MigrateAsync(dataSource, NullLogger.Instance);
        var before = await AppliedVersions(dataSource);

        await DatabaseMigrator.MigrateAsync(dataSource, NullLogger.Instance);

        Assert.Equal(before, await AppliedVersions(dataSource));
    }

    // База из старого init.sql: таблицы есть, истории миграций нет. Применять поверх нельзя — понятная ошибка
    [Fact]
    public async Task DatabaseWithoutMigrationHistory_FailsWithResetHint()
    {
        await using var dataSource = await NewDatabase();
        await using (var cmd = dataSource.CreateCommand("CREATE TABLE users (id UUID PRIMARY KEY)"))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => DatabaseMigrator.MigrateAsync(dataSource, NullLogger.Instance));

        Assert.Contains("reset-db.bat", error.Message);
    }

    private async Task<NpgsqlDataSource> NewDatabase()
    {
        var name = "migrations_" + Guid.NewGuid().ToString("N");
        await using (var admin = NpgsqlDataSource.Create(factory.ConnectionStringFor("postgres")))
        await using (var cmd = admin.CreateCommand($"CREATE DATABASE {name}"))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        return NpgsqlDataSource.Create(factory.ConnectionStringFor(name));
    }

    private static async Task<List<string>> AppliedVersions(NpgsqlDataSource dataSource)
    {
        await using var cmd = dataSource.CreateCommand("SELECT version FROM schema_migrations ORDER BY version");
        await using var reader = await cmd.ExecuteReaderAsync();
        var versions = new List<string>();
        while (await reader.ReadAsync())
        {
            versions.Add(reader.GetString(0));
        }

        return versions;
    }

    private static async Task<T> Scalar<T>(NpgsqlDataSource dataSource, string sql)
    {
        await using var cmd = dataSource.CreateCommand(sql);
        return (T)(await cmd.ExecuteScalarAsync())!;
    }
}
