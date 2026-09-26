using System.ComponentModel.DataAnnotations;


namespace AccountThis.Api.Models;


public class User
{
    public long Id { get; init; }

    [Required]
    [MaxLength(200)]
    public string FullName { get; set; } = null!;

    [Required]
    [Range(0, 150)]
    public int Age { get; set; }

    [Required]
    [RegularExpression("Male|Female")]
    public string Gender { get; set; } = null!;
};
