using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Rules;
using FinanceTracker.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class AccountRepository(AppDbContext dbContext) : IAccountRepository
{
    /// <summary>Unique (UserId, NormalizedName) among non-archived accounts.</summary>
    private const string _activeNameIndex = "IX_Accounts_UserId_NormalizedName";

    public async Task<IReadOnlyList<AccountResponse>> ListWithBalancesAsync(
        Guid userId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Accounts
            .Where(a => a.UserId == userId && (includeArchived || !a.IsArchived))
            .OrderBy(a => a.IsArchived)
            .ThenBy(a => EF.Property<string>(a, ConfigurationConstants.NormalizedName))
            .ThenBy(a => a.Id);

        return await WithBalances(query).ToListAsync(cancellationToken);
    }

    public Task<AccountResponse?> GetWithBalanceAsync(Guid userId, Guid accountId, CancellationToken cancellationToken) =>
        WithBalances(dbContext.Accounts.Where(a => a.UserId == userId && a.Id == accountId))
            .SingleOrDefaultAsync(cancellationToken);

    public Task<Account?> FindAsync(Guid userId, Guid accountId, CancellationToken cancellationToken) =>
        dbContext.Accounts.SingleOrDefaultAsync(a => a.UserId == userId && a.Id == accountId, cancellationToken);

    public Task<bool> ActiveNameExistsAsync(
        Guid userId,
        string name,
        Guid? exceptAccountId,
        CancellationToken cancellationToken)
    {
        // lower(@name) in SQL matches the generated column lower("Name") behind the unique index exactly.
        // The index stays the final arbiter for concurrent requests (TrySaveChangesAsync).
        return dbContext.Accounts.AnyAsync(
            a => a.UserId == userId
                && !a.IsArchived
                && EF.Property<string>(a, ConfigurationConstants.NormalizedName) == PostgresFunctions.Lower(name)
                && (exceptAccountId == null || a.Id != exceptAccountId),
            cancellationToken);
    }

    public Task<int> CountActiveAsync(Guid userId, CancellationToken cancellationToken) =>
        dbContext.Accounts.CountAsync(a => a.UserId == userId && !a.IsArchived, cancellationToken);

    public Task LockUserAccountsAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Transaction-scoped advisory lock keyed by the user, shared by every API instance and released on
        // commit/rollback. A hash collision with another user only serializes two unrelated archives briefly.
        var lockKey = $"accounts:{userId}";
        return dbContext.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
            cancellationToken);
    }

    public void Add(Account account) => dbContext.Accounts.Add(account);

    public async Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (PostgresErrors.IsUniqueViolation(ex, _activeNameIndex))
        {
            dbContext.ChangeTracker.Clear();
            return false;
        }
    }

    /// <summary>
    /// Projects accounts with Balance = InitialBalance + Σ signed transaction amounts, computed by PostgreSQL
    /// (a correlated SUM per account, using the index that starts with AccountId).
    /// </summary>
    private IQueryable<AccountResponse> WithBalances(IQueryable<Account> accounts) =>
        accounts
            .AsNoTracking()
            .Select(a => new AccountResponse(
                a.Id,
                a.Name,
                a.Type,
                a.Currency,
                a.InitialBalance,
                a.InitialBalance + dbContext.Transactions
                    .Where(t => t.AccountId == a.Id && t.UserId == a.UserId)
                    .Sum(BalanceRules.SignedAmount),
                a.IsArchived));
}
