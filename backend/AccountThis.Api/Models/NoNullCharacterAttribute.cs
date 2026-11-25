using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

[AttributeUsage(AttributeTargets.Property)]
public sealed class NoNullCharacterAttribute() : ValidationAttribute("Строка не должна содержать символ U+0000")
{
    public override bool IsValid(object? value) => value is not string text || !text.Contains('\0');
}
