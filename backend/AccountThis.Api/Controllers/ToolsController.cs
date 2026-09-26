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
    /// Реестр активных инструментов (для печати QR-кодов).
    /// </summary>
    [HttpGet]
    public ActionResult<List<Tool>> GetTools()
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Добавление нового инструмента.
    /// </summary>
    [HttpPost]
    public IActionResult CreateTool([FromBody] CreateToolRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Данные инструмента по id.
    /// </summary>
    [HttpGet("{id}")]
    public ActionResult<Tool> GetTool(int id)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Ручное обновление состояния инструмента (фиксация поломки/ремонта вне цикла TAKE/GIVE).
    /// </summary>
    [HttpPatch("{id}")]
    public IActionResult UpdateToolCondition(int id, [FromBody] UpdateToolConditionRequest request)
    {
        throw new NotImplementedException();
    }

    /// <summary>
    /// Списание инструмента (is_active = false). Требуется роль: Owner.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Owner")]
    public IActionResult DeleteTool(int id)
    {
        throw new NotImplementedException();
    }
}