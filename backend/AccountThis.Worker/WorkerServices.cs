using AccountThis.Shared.Configuration;
using Npgsql;

namespace AccountThis.Worker;

public static class WorkerServices
{
    public static IServiceCollection AddAccountThisWorker(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = DatabaseConfiguration.BuildConnectionString(configuration);
        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));

        services.AddHostedService<AuditConsumer>();
        services.AddHostedService<NotificationsConsumer>();
        return services;
    }
}
