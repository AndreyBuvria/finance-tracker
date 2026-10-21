using System.Diagnostics;
using FinanceTracker.Api.Authentication;
using FinanceTracker.Application;
using FinanceTracker.Infrastructure;
using FinanceTracker.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
    // Required-field messages come from the FluentValidation validators (FEATURES.md wording).
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);
builder.Services.AddOpenApi();

builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions.TryAdd(
            "traceId",
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier));

builder.Services.AddSingleton(TimeProvider.System);

builder.Services
    .AddApplication()
    .AddInfrastructure()
    .AddJwtAuthentication();

builder.Services
    .AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database");

var app = builder.Build();

if (app.Configuration.GetValue<bool>(DatabaseMigrator.MigrateOnStartupKey))
{
    await app.Services.MigrateDatabaseAsync(app.Lifetime.ApplicationStopping);
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.MapHealthChecks("/health").AllowAnonymous();
app.MapControllers();

await app.RunAsync();
