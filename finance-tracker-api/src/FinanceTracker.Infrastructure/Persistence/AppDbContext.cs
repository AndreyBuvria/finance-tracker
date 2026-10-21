using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityUserContext<User, Guid>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Account> Accounts => Set<Account>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<Budget> Budgets => Set<Budget>();

    public DbSet<CategoryRule> CategoryRules => Set<CategoryRule>();

    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();

    public DbSet<DeletedImportHash> DeletedImportHashes => Set<DeletedImportHash>();

    public DbSet<Alert> Alerts => Set<Alert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Accent- and case-insensitive search ("zabka" finds "Żabka").
        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder
            .HasDbFunction(typeof(PostgresFunctions).GetMethod(nameof(PostgresFunctions.Unaccent))!)
            .HasName(PostgresFunctions.UnaccentFunctionName);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
