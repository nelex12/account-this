using System.ComponentModel.DataAnnotations;

namespace AccountThis.Api.Models;

// PostgreSQL не хранит символ U+0000 в текстовых полях: строка с ним проходила валидацию и падала на INSERT
// с ошибкой 22021 (ответ 500). Атрибут ставится на поля запросов, которые сохраняются в БД, — ответ 400
// на этапе валидации модели (api.yaml, «Значения в запросах»).
[AttributeUsage(AttributeTargets.Property)]
public sealed class NoNullCharacterAttribute() : ValidationAttribute("Строка не должна содержать символ U+0000")
{
    // null и не строки — забота других атрибутов ([Required] и типа свойства)
    public override bool IsValid(object? value) => value is not string text || !text.Contains('\0');
}
