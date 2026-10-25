using FinanceTracker.Api.Authentication;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Options;

namespace FinanceTracker.IntegrationTests.Authentication;

/// <summary>
/// Startup checks of the JWT settings. These hosts never reach the database (migration on startup is off,
/// or the settings check fails before it), so no PostgreSQL container is needed.
/// </summary>
public sealed class JwtSigningKeyStartupTests
{
    private const string _uniqueSigningKey = "integration-tests-only-unique-production-signing-key-42";

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public void Startup_LocalDevelopmentKeyOutsideDevelopment_FailsWithClearError(string environment)
    {
        using var factory = CreateFactory(environment, JwtOptions.LocalDevelopmentSigningKey);

        var start = () => factory.CreateClient();

        start.Should().Throw<OptionsValidationException>()
            .WithMessage($"*public local-development key*not allowed in the '{environment}' environment*");
    }

    [Fact]
    public void Startup_InvalidKeyWithMigrateOnStartup_FailsBeforeTouchingDatabase()
    {
        // Nothing listens on port 1: if migrations ran first, startup would fail with a connection error instead.
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting(DatabaseMigrator.MigrateOnStartupKey, "true");
            builder.UseSetting("ConnectionStrings:Default", "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none");
            builder.UseSetting("Jwt:SigningKey", JwtOptions.LocalDevelopmentSigningKey);
        });

        var start = () => factory.CreateClient();

        start.Should().Throw<OptionsValidationException>()
            .WithMessage("*public local-development key*");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Testing")]
    public void Startup_LocalDevelopmentKeyInLocalEnvironment_Starts(string environment)
    {
        using var factory = CreateFactory(environment, JwtOptions.LocalDevelopmentSigningKey);

        var start = () => factory.CreateClient().Dispose();

        start.Should().NotThrow();
    }

    [Fact]
    public void Startup_UniqueKeyInProduction_Starts()
    {
        using var factory = CreateFactory("Production", _uniqueSigningKey);

        var start = () => factory.CreateClient().Dispose();

        start.Should().NotThrow();
    }

    private static WebApplicationFactory<Program> CreateFactory(string environment, string signingKey) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting(DatabaseMigrator.MigrateOnStartupKey, "false");
            builder.UseSetting("Jwt:SigningKey", signingKey);
        });
}
