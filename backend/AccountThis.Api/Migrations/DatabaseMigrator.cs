using Npgsql;

namespace AccountThis.Api.Migrations;

// Миграции схемы БД: файлы Migrations/NNNN_описание.sql, встроены в сборку (см. csproj).
// При старте приложения применяются по порядку имён те, которых ещё нет в schema_migrations,
// каждая в своей транзакции вместе с записью о ней: упавшая миграция не оставляет схему наполовину изменённой.
// Применённый файл не меняют — изменение схемы оформляется новым файлом со следующим номером.
public static class DatabaseMigrator
{
    private const string ResourcePrefix = "Migrations/";

    // Произвольная константа: несколько экземпляров backend не применяют миграции одновременно
    private const long AdvisoryLockKey = 0x4163_6354_6869_73;

    public static async Task MigrateAsync(NpgsqlDataSource dataSource, ILogger logger, CancellationToken cancellationToken = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);

        await ExecuteAsync(conn, $"SELECT pg_advisory_lock({AdvisoryLockKey})", cancellationToken);
        try
        {
            await ExecuteAsync(conn,
                "CREATE TABLE IF NOT EXISTS schema_migrations (" +
                "version TEXT PRIMARY KEY, " +
                "applied_at BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT)",
                cancellationToken);

            var applied = await GetAppliedAsync(conn, cancellationToken);
            if (applied.Count == 0 && await TableExistsAsync(conn, "users", cancellationToken))
            {
                throw new InvalidOperationException(
                    "База создана до появления миграций (старым init.sql), её схема неизвестна. " +
                    "Пересоздайте базу один раз: reset-db.bat (данные будут удалены).");
            }

            foreach (var (version, sql) in LoadScripts())
            {
                if (applied.Contains(version))
                {
                    continue;
                }

                await using var transaction = await conn.BeginTransactionAsync(cancellationToken);

                await using (var cmd = new NpgsqlCommand(sql, conn, transaction))
                {
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }

                await using (var cmd = new NpgsqlCommand("INSERT INTO schema_migrations (version) VALUES (@version)", conn, transaction))
                {
                    cmd.Parameters.AddWithValue("version", version);
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation("Применена миграция {Version}", version);
            }
        }
        finally
        {
            await ExecuteAsync(conn, $"SELECT pg_advisory_unlock({AdvisoryLockKey})", CancellationToken.None);
        }
    }

    // version — имя файла без .sql: "0001_init"
    private static IEnumerable<(string Version, string Sql)> LoadScripts()
    {
        var assembly = typeof(DatabaseMigrator).Assembly;
        var names = assembly.GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal) && n.EndsWith(".sql", StringComparison.Ordinal))
            .Order(StringComparer.Ordinal);

        foreach (var name in names)
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            yield return (Path.GetFileNameWithoutExtension(name[ResourcePrefix.Length..]), reader.ReadToEnd());
        }
    }

    private static async Task<HashSet<string>> GetAppliedAsync(NpgsqlConnection conn, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand("SELECT version FROM schema_migrations", conn);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);

        var applied = new HashSet<string>(StringComparer.Ordinal);
        while (await reader.ReadAsync(cancellationToken))
        {
            applied.Add(reader.GetString(0));
        }

        return applied;
    }

    private static async Task<bool> TableExistsAsync(NpgsqlConnection conn, string table, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand("SELECT to_regclass(@table) IS NOT NULL", conn);
        cmd.Parameters.AddWithValue("table", "public." + table);
        return (bool)(await cmd.ExecuteScalarAsync(cancellationToken))!;
    }

    private static async Task ExecuteAsync(NpgsqlConnection conn, string sql, CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
}
