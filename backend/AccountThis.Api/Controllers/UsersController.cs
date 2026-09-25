using AccountThis.Api.Models;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace AccountThis.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly NpgsqlDataSource _dataSource;

    public UsersController(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    // GET /api/users
    [HttpGet]
    public async Task<IEnumerable<User>> GetAll()
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        return await connection.QueryAsync<User>(
            """
            SELECT id, full_name AS FullName, gender, age, created_at AS CreatedAt
            FROM users
            ORDER BY id
            """);
    }

    // GET /api/users/1
    [HttpGet("{id:long}")]
    public async Task<ActionResult<User>> GetById(long id)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var user = await connection.QueryFirstOrDefaultAsync<User>(
            """
            SELECT id, full_name AS FullName, gender, age, created_at AS CreatedAt
            FROM users
            WHERE id = @id
            """, new { id });

        return user is null ? NotFound() : Ok(user);
    }
}
