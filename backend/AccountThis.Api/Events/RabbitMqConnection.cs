using RabbitMQ.Client;

namespace AccountThis.Api.Events;

// Топология и подключение к брокеру (docs/events.md, «Топология», «Настройки»)
public static class RabbitMqTopology
{
    public const string Exchange = "accountthis.events";
    public const string AuditQueue = "audit";
    public const string DeadLetterExchange = "accountthis.events.dlx";
    public const string DeadLetterQueue = "audit.dead";

    // Объявление идемпотентно: издатель и потребитель вызывают его при каждом подключении.
    // Издатель объявляет и очередь audit — иначе события, опубликованные до старта потребителя, некуда было бы положить
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

        await channel.QueueDeclareAsync(AuditQueue, durable: true, exclusive: false, autoDelete: false,
            arguments: new Dictionary<string, object?> { ["x-dead-letter-exchange"] = DeadLetterExchange },
            cancellationToken: cancellationToken);
        await channel.QueueBindAsync(AuditQueue, Exchange, routingKey: "#", cancellationToken: cancellationToken);
    }

    public static ConnectionFactory CreateFactory(IConfiguration configuration, string clientName) => new()
    {
        HostName = configuration["RABBITMQ_HOST"] ?? "localhost",
        Port = configuration.GetValue("RABBITMQ_PORT", 5672),
        UserName = configuration["RABBITMQ_USER"] ?? "guest",
        Password = configuration["RABBITMQ_PASSWORD"] ?? "guest",
        ClientProvidedName = clientName,
        // Обрыв связи после подключения клиент восстанавливает сам, вместе с очередями и подписками
        AutomaticRecoveryEnabled = true,
        TopologyRecoveryEnabled = true,
        RequestedConnectionTimeout = TimeSpan.FromSeconds(5),
    };
}
