using AccountThis.Api.Configuration;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
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

builder.Services.AddSingleton(TimeProvider.System);

// Сквозные сервисы безопасности: без состояния, ключи читаются из конфигурации один раз
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<ISignatureService, SignatureService>();

// Бизнес-логика контроллеров; к БД обращаются через NpgsqlDataSource
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompaniesService, CompaniesService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IToolsService, ToolsService>();
builder.Services.AddScoped<ISyncService, SyncService>();

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
