namespace AccountThis.Api.Models;

public record User
{
    public long Id { get; init; }
    public string FullName { get; init; } = default!;
    public string? Gender { get; init; }
    public short? Age { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
