using System.Text.Json;
using System.Threading.Channels;
using RabbitMQ.Client;

namespace AccountThis.Api.Events;

// Публикация событий аудита (docs/events.md, «Издатель»). Вызывается сервисами ПОСЛЕ COMMIT.
// Publish не ждёт брокера: событие ставится в очередь в памяти, отправляет его фоновый цикл с publisher confirms.
// Ошибка отправки — Warning в лог, HTTP-ответ от неё не зависит (действие уже зафиксировано).
public interface IEventPublisher
{
    void Publish(string type, Guid companyId, Guid actorId, object data);
}

public sealed class RabbitMqEventPublisher(
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<RabbitMqEventPublisher> logger) : BackgroundService, IEventPublisher
{
    private readonly Channel<AuditEvent> _pending = Channel.CreateUnbounded<AuditEvent>(
        new UnboundedChannelOptions { SingleReader = true });

    private IConnection? _connection;
    private IChannel? _channel;

    public void Publish(string type, Guid companyId, Guid actorId, object data)
    {
        var auditEvent = AuditEvent.Create(type, companyId, actorId, data, timeProvider.GetUtcNow().ToUnixTimeSeconds());
        if (!_pending.Writer.TryWrite(auditEvent))
        {
            logger.LogWarning("Событие {EventId} ({Type}) не опубликовано: приложение останавливается", auditEvent.EventId, type);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Канал читает только этот цикл, поэтому один IChannel не используется из нескольких потоков
            await foreach (var auditEvent in _pending.Reader.ReadAllAsync(stoppingToken))
            {
                await SendAsync(auditEvent, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        finally
        {
            await CloseAsync();
        }
    }

    // При остановке приложения успеваем отправить накопленное (не дольше 5 секунд)
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _pending.Writer.TryComplete();
        if (ExecuteTask is not null)
        {
            await Task.WhenAny(ExecuteTask, Task.Delay(TimeSpan.FromSeconds(5), cancellationToken));
        }

        await base.StopAsync(cancellationToken);
    }

    private async Task SendAsync(AuditEvent auditEvent, CancellationToken cancellationToken)
    {
        try
        {
            var channel = await GetChannelAsync(cancellationToken);
            var properties = new BasicProperties
            {
                ContentType = "application/json",
                DeliveryMode = DeliveryModes.Persistent,
                MessageId = auditEvent.EventId.ToString(),
                Type = auditEvent.Type,
            };
            var body = JsonSerializer.SerializeToUtf8Bytes(auditEvent, AuditEvent.JsonOptions);

            // С отслеживанием подтверждений вызов завершается, когда брокер принял сообщение (или бросает при отказе)
            await channel.BasicPublishAsync(RabbitMqTopology.Exchange, auditEvent.Type, mandatory: false, properties, body,
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Событие {EventId} ({Type}) не опубликовано в RabbitMQ", auditEvent.EventId, auditEvent.Type);
            await CloseAsync();
        }
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        await CloseAsync();
        var factory = RabbitMqTopology.CreateFactory(configuration, "accountthis-api-publisher");
        _connection = await factory.CreateConnectionAsync(cancellationToken);
        _channel = await _connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            cancellationToken);
        await RabbitMqTopology.DeclareAsync(_channel, cancellationToken);
        return _channel;
    }

    private async Task CloseAsync()
    {
        try
        {
            if (_channel is not null)
            {
                await _channel.DisposeAsync();
            }

            if (_connection is not null)
            {
                await _connection.DisposeAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Ошибка при закрытии соединения с RabbitMQ");
        }
        finally
        {
            _channel = null;
            _connection = null;
        }
    }
}
