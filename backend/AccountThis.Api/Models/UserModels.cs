namespace AccountThis.Api.Models;

public class UserResponse
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public bool IsApproved { get; set; }

    public bool IsActive { get; set; }
}