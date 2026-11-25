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

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddDotEnvFile(builder.Environment.ContentRootPath);
}

builder.Services.AddControllers(options =>
    options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddProblemDetails();

var jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"];
if (string.IsNullOrEmpty(jwtSigningKey))
{
    throw new InvalidOperationException(
        "Переменная JWT_SIGNING_KEY не задана. Скопируйте env.example в .env и сгенерируйте ключи (generate-keys.bat).");
}

if (Base64UrlEncoder.DecodeBytes(jwtSigningKey).Length < 32)
{
    throw new InvalidOperationException(
        "JWT_SIGNING_KEY короче 32 байт. Сгенерируйте ключ заново (generate-keys.bat).");
}

if (string.IsNullOrEmpty(builder.Configuration["SERVER_SIGNING_KEY"]))
{
    throw new InvalidOperationException(
        "Переменная SERVER_SIGNING_KEY не задана. Скопируйте env.example в .env и сгенерируйте ключи (generate-keys.bat).");
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
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = "role",
        };
    });
builder.Services.AddAuthorization();

var connectionString = DatabaseConfiguration.BuildConnectionString(builder.Configuration);
var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<ISignatureService, SignatureService>();

builder.Services.AddSingleton<IEventOutbox, EventOutbox>();
builder.Services.AddHostedService<OutboxDispatcher>();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICompaniesService, CompaniesService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IToolsService, ToolsService>();
builder.Services.AddScoped<ISyncService, SyncService>();
builder.Services.AddScoped<INotificationsService, NotificationsService>();

var app = builder.Build();

_ = app.Services.GetRequiredService<ISignatureService>();

await DatabaseMigrator.MigrateAsync(dataSource, app.Logger);

app.UseExceptionHandler();

if (builder.Configuration.GetValue<bool>("ENABLE_SWAGGER"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
