using AccountThis.Shared.Configuration;
using AccountThis.Worker;

var builder = Host.CreateApplicationBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddDotEnvFile(builder.Environment.ContentRootPath);
}

builder.Services.AddAccountThisWorker(builder.Configuration);

builder.Build().Run();
