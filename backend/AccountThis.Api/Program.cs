using AccountThis.Api.Events;
using AccountThis.Api.Migrations;
using AccountThis.Api.Security;
using AccountThis.Api.Services;
using AccountThis.Shared.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// При запуске из IDE (Development) подхватываем общий .env из корня репозитория.
// В Docker переменные передаёт docker-compose.yml.
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddDotEnvFile(builder.Environment.ContentRootPath);
}

// Ключи errors в 400 — имена полей JSON (fullName), а не свойств C# (FullName), как в api.yaml
builder.Services.AddControllers(options =>
    options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Необработанное исключение — 500 с телом ProblemDetails (traceId для поиска в логах), без подробностей наружу.
// Ответы 401/403 проверки JWT остаются без тела: UseStatusCodePages не подключается
builder.Services.AddProblemDetails();

// JWT: HMAC-SHA256 с секретом JWT_SIGNING_KEY (тот же, которым подписывает JwtTokenService).
// Имена claims — как в токене (sub, role, company_id), без переименования в длинные URI
var jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"];
if (string.IsNullOrEmpty(jwtSigningKey))
{
    throw new InvalidOperationException(
        "Переменная JWT_SIGNING_KEY не задана. Скопируйте env.example в .env и сгенерируйте ключи (generate-keys.bat).");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Base64UrlEncoder.DecodeBytes(jwtSigningKey)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateIssuer = false,
            ValidateAudience = false,
            // По умолчанию токен принимается ещё 5 минут после истечения; по api.yaml срок — ровно 15 минут
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = "role",
        };
    });
builder.Services.AddAuthorization();

// Строка подключения собирается из POSTGRES_* (см. DatabaseConfiguration)
var connectionString = DatabaseConfiguration.BuildConnectionString(builder.Configuration);
var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

builder.Services.AddSingleton(TimeProvider.System);

// Сквозные сервисы безопасности: без состояния, ключи читаются из конфигурации один раз
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<ISignatureService, SignatureService>();

// События (docs/events.md): сервисы пишут их в outbox_events в своей транзакции, фоновый диспетчер отправляет в RabbitMQ.
// Потребители событий — отдельный процесс AccountThis.Worker
builder.Services.AddSingleton<IEventOutbox, EventOutbox>();
builder.Services.AddHostedService<OutboxDispatcher>();

// Бизнес-логика контроллеров; к БД обращаются через NpgsqlDataSource
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompaniesService, CompaniesService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IToolsService, ToolsService>();
builder.Services.AddScoped<ISyncService, SyncService>();
builder.Services.AddScoped<INotificationsService, NotificationsService>();

var app = builder.Build();

// Схема БД приводится к актуальной до приёма запросов (Migrations/*.sql)
await DatabaseMigrator.MigrateAsync(dataSource, app.Logger);

app.UseExceptionHandler();

// Swagger включается только если явно указан флаг в переменных окружения
if (builder.Configuration.GetValue<bool>("ENABLE_SWAGGER"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Нужен WebApplicationFactory<Program> в AccountThis.Api.Tests: класс из top-level statements по умолчанию internal
public partial class Program;
