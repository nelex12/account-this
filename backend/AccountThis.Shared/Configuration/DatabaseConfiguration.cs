using Microsoft.Extensions.Configuration;
using Npgsql;

namespace AccountThis.Shared.Configuration;

public static class DatabaseConfiguration
{
    public static string BuildConnectionString(IConfiguration configuration)
    {
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
