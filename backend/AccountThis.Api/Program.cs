using AccountThis.Api.Configuration;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// При запуске из IDE (Development) подхватываем общий .env из корня репозитория.
// В Docker переменные передаёт docker-compose.yml.
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddDotEnvFile(builder.Environment.ContentRootPath);
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Строка подключения собирается из POSTGRES_* (см. DatabaseConfiguration). Без миграций, БД уже существует
var connectionString = DatabaseConfiguration.BuildConnectionString(builder.Configuration);

var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

var app = builder.Build();

// Swagger включается только если явно указан флаг в переменных окружения
var swaggerEnabled = builder.Configuration.GetValue<bool>("ENABLE_SWAGGER");
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

app.Run();
