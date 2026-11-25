using AccountThis.Api.Models;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/tools")]
[Authorize(Roles = "Issuer,Owner")]
public class ToolsController(IToolsService toolsService) : ControllerBase
{
    /// <summary>Активные инструменты компании.</summary>
    [HttpGet]
    public async Task<ActionResult<List<Tool>>> GetTools(CancellationToken cancellationToken)
    {
        return await toolsService.GetActiveToolsAsync(User.GetCompanyId(), cancellationToken);
    }

    /// <summary>Добавление инструмента.</summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Tool>> CreateTool([FromBody] CreateToolRequest request, CancellationToken cancellationToken)
    {
        var tool = await toolsService.CreateAsync(User.GetCompanyId(), User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetTool), new { id = tool.Id }, tool);
    }

    /// <summary>Карточка инструмента.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Tool>> GetTool(Guid id, CancellationToken cancellationToken)
    {
        var tool = await toolsService.GetByIdAsync(User.GetCompanyId(), id, cancellationToken);
        return tool is null ? ToolNotFound(id) : tool;
    }

    /// <summary>Изменение состояния инструмента.</summary>
    [HttpPatch("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateToolCondition(Guid id, [FromBody] UpdateToolConditionRequest request, CancellationToken cancellationToken)
    {
        return await toolsService.UpdateConditionAsync(User.GetCompanyId(), User.GetUserId(), id, request, cancellationToken) ? Ok() : ToolNotFound(id);
    }

    /// <summary>Списание инструмента.</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTool(Guid id, CancellationToken cancellationToken)
    {
        return await toolsService.DeactivateAsync(User.GetCompanyId(), User.GetUserId(), id, cancellationToken) ? Ok() : ToolNotFound(id);
    }

    private ObjectResult ToolNotFound(Guid id) =>
        Problem(statusCode: StatusCodes.Status404NotFound, detail: $"Инструмент с id {id} не найден");
}
