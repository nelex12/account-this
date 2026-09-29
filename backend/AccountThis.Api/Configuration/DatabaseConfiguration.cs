using Npgsql;

namespace AccountThis.Api.Configuration;

// Строка подключения собирается из тех же переменных, с которыми создаётся контейнер postgres (.env),
// поэтому логин и пароль к базе задаются в одном месте.
public static class DatabaseConfiguration
{
    public static string BuildConnectionString(IConfiguration configuration)
    {
        // Адрес базы зависит от способа запуска:
        // - из IDE — localhost и порт, проброшенный из контейнера на компьютер (POSTGRES_PORT в .env);
        // - в Docker — имя сервиса postgres и порт 5432 внутри сети compose (задаёт docker-compose.yml).
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = configuration["POSTGRES_HOST"] ?? "localhost",
            Port = configuration.GetValue("POSTGRES_PORT", 5432),
            Database = GetRequired(configuration, "POSTGRES_DB"),
            Username = GetRequired(configuration, "POSTGRES_USER"),
            Password = GetRequired(configuration, "POSTGRES_PASSWORD"),
        };

        return builder.ConnectionString;
    }

    private static string GetRequired(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        if (string.IsNullOrEmpty(value))
        {
            throw new InvalidOperationException(
                $"Переменная {key} не задана. Скопируйте env.example в .env в корне репозитория и заполните значения.");
        }

        return value;
    }
}
