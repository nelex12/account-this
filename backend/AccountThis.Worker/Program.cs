using AccountThis.Shared.Configuration;
using AccountThis.Worker;

// Отдельный процесс-потребитель событий (docs/events.md). API о нём не знает: он только пишет события в outbox
// и отправляет их в RabbitMQ. Worker можно остановить, перезапустить или запустить в нескольких экземплярах —
// события ждут в очередях брокера.
var builder = Host.CreateApplicationBuilder(args);

// При запуске из IDE (Development) — общий .env из корня репозитория, как у API. В Docker переменные задаёт docker-compose.yml
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddDotEnvFile(builder.Environment.ContentRootPath);
}

builder.Services.AddAccountThisWorker(builder.Configuration);

builder.Build().Run();
