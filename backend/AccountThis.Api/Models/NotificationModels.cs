namespace AccountThis.Api.Models;

// components.schemas.Notification
// Создаёт AccountThis.Worker по событиям из RabbitMQ, поэтому уведомление появляется с небольшой задержкой после действия
public class Notification
{
    public long Id { get; set; }

    public NotificationType Type { get; set; }

    // Unix time события, породившего уведомление
    public long OccurredAt { get; set; }

    // О ком уведомление: новый сотрудник (EmployeeAwaitingApproval), владелец сессии (SessionReuseDetected),
    // завхоз (SuspiciousSync)
    public Guid UserId { get; set; }

    // ФИО из users; null — пользователя нет в компании
    public string? UserName { get; set; }

    // Только SuspiciousSync: число сохранённых записей по флагам, кроме VALID. У остальных типов — null
    public Dictionary<string, int>? Flags { get; set; }

    public bool IsRead { get; set; }
}
