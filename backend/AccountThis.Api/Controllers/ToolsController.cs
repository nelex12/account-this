using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

// Базовый уровень доступа: Issuer, Owner. Списание (DeleteTool) отдельно сужено до Owner.
// У каждой компании свой реестр: методы работают только с инструментами компании вызывающего (company_id из JWT);
// инструмент другой компании неотличим от несуществующего: 404.
[ApiController]
[Route("api/tools")]
[Authorize(Roles = "Issuer,Owner")]
public class ToolsController(IToolsService toolsService) : ControllerBase
{
    /// <summary>
    /// Реестр активных (не списанных) инструментов своей компании — локальный реестр завхоза и печать QR-кодов.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<Tool>>> GetTools(CancellationToken cancellationToken)
    {
        return await toolsService.GetActiveToolsAsync(User.GetCompanyId(), cancellationToken);
    }

    /// <summary>
    /// Добавление нового инструмента в реестр своей компании (состояние Good). id (UUID) присваивает БД;
    /// созданный инструмент возвращается в ответе (201, CreatedAtAction на GetTool — заголовок Location) — по id печатается QR.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Tool>> CreateTool([FromBody] CreateToolRequest request, CancellationToken cancellationToken)
    {
        var tool = await toolsService.CreateAsync(User.GetCompanyId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetTool), new { id = tool.Id }, tool);
    }

    /// <summary>
    /// Данные инструмента по id (в том числе списанного).
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Tool>> GetTool(Guid id, CancellationToken cancellationToken)
    {
        var tool = await toolsService.GetByIdAsync(User.GetCompanyId(), id, cancellationToken);
        return tool is null ? ToolNotFound(id) : tool;
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
    public async Task<IActionResult> UpdateToolCondition(Guid id, [FromBody] UpdateToolConditionRequest request, CancellationToken cancellationToken)
    {
        return await toolsService.UpdateConditionAsync(User.GetCompanyId(), id, request, cancellationToken) ? Ok() : ToolNotFound(id);
    }

    /// <summary>
    /// Списание инструмента (is_active = false), необратимо. Повторный вызов — 200. Требуется роль: Owner.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTool(Guid id, CancellationToken cancellationToken)
    {
        return await toolsService.DeactivateAsync(User.GetCompanyId(), id, cancellationToken) ? Ok() : ToolNotFound(id);
    }

    private ObjectResult ToolNotFound(Guid id) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Инструмент с id {id} не найден");
}
