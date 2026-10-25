using System.Diagnostics;
using FinanceTracker.Api.Authentication;
using FinanceTracker.Api.Json;
using FinanceTracker.Api.ModelBinding;
using FinanceTracker.Api.OpenApi;
using FinanceTracker.Application;
using FinanceTracker.Infrastructure;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers(options =>
    {
        // Required-field messages come from the FluentValidation validators (FEATURES.md wording).
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
        // Query-string enums behave like JSON ones: unknown values reach the validators (see the provider).
        options.ModelBinderProviders.Insert(0, new EnumNameModelBinderProvider());
        options.ModelBinderProviders.Insert(0, new InvariantDecimalModelBinderProvider());
        // A query value that can't be read (e.g. "from=yesterday") gets a plain message without .NET details.
        options.ModelBindingMessageProvider.SetAttemptedValueIsInvalidAccessor((_, _) => QueryBinding.InvalidValue);
        options.ModelBindingMessageProvider.SetNonPropertyAttemptedValueIsInvalidAccessor(_ => QueryBinding.InvalidValue);
        options.ModelBindingMessageProvider.SetValueIsInvalidAccessor(_ => QueryBinding.InvalidValue);
        options.ModelBindingMessageProvider.SetNonPropertyValueMustBeANumberAccessor(() => QueryBinding.InvalidValue);
        options.ModelBindingMessageProvider.SetValueMustBeANumberAccessor(_ => QueryBinding.InvalidValue);
    })
    .ConfigureApiBehaviorOptions(options =>
        // Binding errors are keyed by camelCase field name ("from"), like the validators' errors.
        options.InvalidModelStateResponseFactory = QueryBinding.CamelCaseValidationProblem)
    .AddJsonOptions(options =>
    {
        // Enums travel as their names ("Card", "Expense"), never as numbers; unknown values reach the
        // validators, which report them on the field itself.
        options.JsonSerializerOptions.Converters.Add(new EnumNameConverterFactory());
        // Malformed JSON gets a generic message instead of one naming internal .NET types.
        options.AllowInputFormatterExceptionMessages = false;
    });
builder.Services.AddOpenApi(options =>
{
    options.AddOperationTransformer<ResponseContentTypesTransformer>();
    options.AddSchemaTransformer<EnumNamesSchemaTransformer>();
});

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

// Run the ValidateOnStart option checks (e.g. the JWT signing key) now rather than when the host starts,
// so a misconfigured deployment fails before it touches the database.
app.Services.GetRequiredService<IStartupValidator>().Validate();

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
