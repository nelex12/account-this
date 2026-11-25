namespace AccountThis.Api.Models;

public class Company
{
    public Guid Id { get; set; }

    // Не длиннее 100 символов, не уникально
    public string Name { get; set; } = string.Empty;
}
