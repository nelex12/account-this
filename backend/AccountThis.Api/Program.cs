using Microsoft.AspNetCore.Http.HttpResults;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Строка подключения приходит из переменной окружения ConnectionStrings__Default
// (см. docker-compose.yml). Никаких миграций - база уже существует и готова.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

var app = builder.Build();

// Swagger включается только если явно указан флаг ENABLE_SWAGGER=true
var swaggerEnabled = builder.Configuration.GetValue<bool>("ENABLE_SWAGGER");
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

app.Run();

//CREATE TABLE users (
//    id BIGSERIAL PRIMARY KEY,
//    full_name VARCHAR(200) NOT NULL,
//    age INT NOT NULL CHECK (age BETWEEN 0 AND 150),
//    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female'))
//);