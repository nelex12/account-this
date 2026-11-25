using Microsoft.Extensions.Configuration;
using RabbitMQ.Client;

namespace AccountThis.Shared.Events;

public static class RabbitMqTopology
{
    public const string Exchange = "accountthis.events";
    public const string DeadLetterExchange = "accountthis.events.dlx";
    public const string DeadLetterQueue = "events.dead";

    public const string AuditQueue = "audit";
    public const string NotificationsQueue = "notifications";

    public static readonly IReadOnlyDictionary<string, string[]> Queues = new Dictionary<string, string[]>
    {
        // Журнал аудита хранит всё
        [AuditQueue] = ["#"],

        [NotificationsQueue] =
        [
            EventTypes.UserRegistered,
            EventTypes.UserApproved,
            EventTypes.UserDeactivated,
            EventTypes.AuthSessionReuseDetected,
            EventTypes.RentalSynced,
        ],
    };

    public static async Task DeclareAsync(IChannel channel, CancellationToken cancellationToken)
    {
        await channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, autoDelete: false,
            cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync(DeadLetterExchange, ExchangeType.Fanout, durable: true, autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.QueueDeclareAsync(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false,
            cancellationToken: cancellationToken);
        await channel.QueueBindAsync(DeadLetterQueue, DeadLetterExchange, routingKey: string.Empty,
            cancellationToken: cancellationToken);

        foreach (var (queue, routingKeys) in Queues)
        {
            await channel.QueueDeclareAsync(queue, durable: true, exclusive: false, autoDelete: false,
                arguments: new Dictionary<string, object?> { ["x-dead-letter-exchange"] = DeadLetterExchange },
                cancellationToken: cancellationToken);
            foreach (var routingKey in routingKeys)
            {
                await channel.QueueBindAsync(queue, Exchange, routingKey, cancellationToken: cancellationToken);
            }
        }
    }

    public static ConnectionFactory CreateFactory(IConfiguration configuration, string clientName) => new()
    {
        HostName = configuration["RABBITMQ_HOST"] ?? "localhost",
        Port = configuration.GetValue("RABBITMQ_PORT", 5672),
        UserName = configuration["RABBITMQ_USER"] ?? "guest",
        Password = configuration["RABBITMQ_PASSWORD"] ?? "guest",
        ClientProvidedName = clientName,
        AutomaticRecoveryEnabled = true,
        TopologyRecoveryEnabled = true,
        RequestedConnectionTimeout = TimeSpan.FromSeconds(5),
    };
}
