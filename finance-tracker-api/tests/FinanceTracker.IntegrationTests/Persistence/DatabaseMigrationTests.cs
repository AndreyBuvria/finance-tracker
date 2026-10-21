using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Persistence;

public sealed class DatabaseMigrationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Migrate_FreshDatabase_AppliesAllMigrations()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pending = await dbContext.Database.GetPendingMigrationsAsync(TestContext.Current.CancellationToken);

        pending.Should().BeEmpty();
    }

    [Fact]
    public async Task Migrate_FreshDatabase_InstallsSearchExtensions()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var extensions = await dbContext.Database
            .SqlQueryRaw<string>("SELECT extname AS \"Value\" FROM pg_extension")
            .ToListAsync(TestContext.Current.CancellationToken);

        extensions.Should().Contain(["unaccent", "pg_trgm"]);
    }

    [Fact]
    public async Task Migrate_FreshDatabase_CreatesTransactionSearchTrigramIndexes()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var indexes = await dbContext.Database
            .SqlQueryRaw<string>(
                "SELECT indexname AS \"Value\" FROM pg_indexes WHERE tablename = 'Transactions' AND indexdef LIKE '%gin_trgm_ops%'")
            .ToListAsync(TestContext.Current.CancellationToken);

        indexes.Should().BeEquivalentTo(["IX_Transactions_Merchant_Trgm", "IX_Transactions_Note_Trgm"]);
    }

    [Fact]
    public async Task Unaccent_PolishMerchantName_RemovesDiacritics()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var result = await dbContext.Database
            .SqlQuery<string>($"SELECT public.f_unaccent('Żabka Łódź') AS \"Value\"")
            .SingleAsync(TestContext.Current.CancellationToken);

        result.Should().Be("Zabka Lodz");
    }

    [Fact]
    public async Task Migrate_FreshDatabase_UserNameIndexIsUnique()
    {
        var indexDefinition = await QuerySingleAsync(
            "SELECT indexdef AS \"Value\" FROM pg_indexes WHERE indexname = 'UserNameIndex'");

        indexDefinition.Should().StartWith("CREATE UNIQUE INDEX");
    }

    [Fact]
    public async Task Migrate_FreshDatabase_CategoryNameUniqueOnlyAmongActive()
    {
        var indexDefinition = await QuerySingleAsync(
            "SELECT indexdef AS \"Value\" FROM pg_indexes WHERE indexname = 'IX_Categories_UserId_Type_NormalizedName'");

        indexDefinition.Should().StartWith("CREATE UNIQUE INDEX")
            .And.Contain("\"NormalizedName\"")
            .And.Contain("WHERE (\"IsArchived\" = false)");
    }

    [Theory]
    [InlineData("CK_Transactions_CategoryId", "((\"Type\")::text = 'Transfer'::text) = (\"CategoryId\" IS NULL)")]
    [InlineData("CK_Categories_Color_Hex", "'^#[0-9a-f]{6}$'")]
    public async Task Migrate_FreshDatabase_CreatesCheckConstraint(string constraintName, string expectedFragment)
    {
        var definition = await QuerySingleAsync(
            $"SELECT pg_get_constraintdef(oid) AS \"Value\" FROM pg_constraint WHERE conname = '{constraintName}'");

        definition.Should().Contain(expectedFragment);
    }

    private async Task<string> QuerySingleAsync(string sql)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        return await dbContext.Database
            .SqlQueryRaw<string>(sql)
            .SingleAsync(TestContext.Current.CancellationToken);
    }
}
