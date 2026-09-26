using AccountThis.Api.Models;
using Dapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Data.Common;

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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] User user)
    {
        await using var command = _dataSource.CreateCommand("INSERT INTO users (full_name, age, gender) VALUES (@FullName, @Age, @Gender)");

        command.Parameters.AddWithValue("@FullName", user.FullName);
        command.Parameters.AddWithValue("@Age", user.Age);
        command.Parameters.AddWithValue("@Gender", user.Gender);

        await command.ExecuteNonQueryAsync();

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        await using var command = _dataSource.CreateCommand("SELECT id, full_name AS FullName, age, gender FROM users");
        await using var reader = await command.ExecuteReaderAsync();
        var users = new List<User>();
        while (await reader.ReadAsync())
        {
            users.Add(new User
            {
                Id = reader.GetInt64(0),
                FullName = reader.GetString(1),
                Age = reader.GetInt32(2),
                Gender = reader.GetString(3)
            });
        }
        return Ok(users);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] User user)
    {
        await using var command = _dataSource.CreateCommand("UPDATE users SET full_name = @FullName, age = @Age, gender = @Gender WHERE id = @Id");
        command.Parameters.AddWithValue("@Id", user.Id);
        command.Parameters.AddWithValue("@FullName", user.FullName);
        command.Parameters.AddWithValue("@Age", user.Age);
        command.Parameters.AddWithValue("@Gender", user.Gender);
        var rowsAffected = await command.ExecuteNonQueryAsync();
        if (rowsAffected == 0)
        {
            return NotFound();
        }
        return Ok();
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] long id)
    {
        await using var command = _dataSource.CreateCommand("DELETE FROM users WHERE id = @Id");
        command.Parameters.AddWithValue("@Id", id);
        var rowsAffected = await command.ExecuteNonQueryAsync();
        if (rowsAffected == 0)
        {
            return NotFound();
        }
        return Ok();
    }
}
