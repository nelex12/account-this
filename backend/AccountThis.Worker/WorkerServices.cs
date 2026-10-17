using AccountThis.Shared.Configuration;
using Npgsql;

namespace AccountThis.Worker;

public static class WorkerServices
{
    // Отдельным методом, чтобы интеграционные тесты запускали те же потребители, что и Program.cs
    public static IServiceCollection AddAccountThisWorker(this IServiceCollection services, IConfiguration configuration)
    {
        // Строка подключения — из тех же POSTGRES_*, что у API. Схему создают миграции API:
        // пока их нет, запись падает с ошибкой БД и сообщение возвращается в очередь до следующей попытки
        var connectionString = DatabaseConfiguration.BuildConnectionString(configuration);
        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));

        services.AddHostedService<AuditConsumer>();
        services.AddHostedService<NotificationsConsumer>();
        return services;
    }
}
