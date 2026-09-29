using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AccountThis.Api.Models;

namespace AccountThis.Api.Controllers;

// Базовый уровень доступа: Issuer, Owner. Списание (DeleteTool) отдельно сужено до Owner.
[ApiController]
[Route("api/tools")]
[Authorize(Roles = "Issuer,Owner")]
public class ToolsController : ControllerBase
{
    /// <summary>
    /// Реестр активных (не списанных) инструментов — локальный реестр завхоза и печать QR-кодов.
    /// </summary>
    [HttpGet]
    public ActionResult<List<Tool>> GetTools()
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Добавление нового инструмента (состояние Good). id присваивает БД;
    /// созданный инструмент возвращается в ответе (201, CreatedAtAction на GetTool — заголовок Location) — по id печатается QR.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public ActionResult<Tool> CreateTool([FromBody] CreateToolRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Данные инструмента по id (в том числе списанного).
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public ActionResult<Tool> GetTool(int id)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Ручное обновление состояния инструмента (фиксация поломки/ремонта вне цикла TAKE/GIVE).
    /// Изменение condition выставляет время изменения состояния в текущее время сервера.
    /// Разрешено и для списанного инструмента (is_active не меняется).
    /// </summary>
    [HttpPatch("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult UpdateToolCondition(int id, [FromBody] UpdateToolConditionRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Списание инструмента (is_active = false), необратимо. Повторный вызов — 200. Требуется роль: Owner.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult DeleteTool(int id)
    {
        throw new NotImplementedException();
    }
}
