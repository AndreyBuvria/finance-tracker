using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Infrastructure.Persistence;

public static class DatabaseMigrator
{
    /// <summary>
    /// Configuration key that enables applying pending EF Core migrations at startup.
    /// Intended for local development and integration tests only; deployed environments
    /// apply migrations as an explicit release step.
    /// </summary>
    public const string MigrateOnStartupKey = "Database:MigrateOnStartup";

    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
