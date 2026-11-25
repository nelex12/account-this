namespace AccountThis.Api.Models;

public class Notification
{
    public long Id { get; set; }

    public NotificationType Type { get; set; }

    // Unix time события, породившего уведомление
    public long OccurredAt { get; set; }

    public Guid UserId { get; set; }

    // ФИО из users; null — пользователя нет в компании
    public string? UserName { get; set; }

    public Dictionary<string, int>? Flags { get; set; }

    public bool IsRead { get; set; }
}
