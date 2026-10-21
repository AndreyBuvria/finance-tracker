using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;

namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the API in memory against a throwaway PostgreSQL container, with a fake clock so "now"
/// is deterministic and token expiry can be tested by advancing <see cref="Time"/>.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    /// <summary>Test-only signing key; it never leaves the test process.</summary>
    private const string _testSigningKey = "integration-tests-only-jwt-signing-key-0123456789";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine")
        .WithDatabase("finance_tracker_tests")
        .Build();

    public FakeTimeProvider Time { get; } = new(new DateTimeOffset(2026, 10, 21, 10, 0, 0, TimeSpan.Zero));

    public async ValueTask InitializeAsync() => await _postgres.StartAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
        builder.UseSetting(DatabaseMigrator.MigrateOnStartupKey, "true");
        builder.UseSetting("Jwt:SigningKey", _testSigningKey);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}
