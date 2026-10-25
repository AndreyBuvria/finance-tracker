using FinanceTracker.Application.Accounts;
using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Application.Abstractions;

/// <summary>User-scoped account persistence. Every method filters by <c>userId</c>; another user's account is never found.</summary>
public interface IAccountRepository
{
    /// <summary>
    /// The user's accounts with balances computed in the database, active ones first, then by name.
    /// Archived accounts are included only when <paramref name="includeArchived"/> is true.
    /// </summary>
    Task<IReadOnlyList<AccountResponse>> ListWithBalancesAsync(
        Guid userId,
        bool includeArchived,
        CancellationToken cancellationToken);

    /// <summary>One account with its computed balance, or null when the user has no such account.</summary>
    Task<AccountResponse?> GetWithBalanceAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);

    /// <summary>Loads the account for changes (tracked), or null when the user has no such account.</summary>
    Task<Account?> FindAsync(Guid userId, Guid accountId, CancellationToken cancellationToken);

    /// <summary>Whether another active account of the user already has this name, ignoring case.</summary>
    Task<bool> ActiveNameExistsAsync(
        Guid userId,
        string name,
        Guid? exceptAccountId,
        CancellationToken cancellationToken);

    Task<int> CountActiveAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Takes a database lock, held until the current transaction ends, that serializes archiving of one
    /// user's accounts across all API instances. Must be called inside a transaction.
    /// </summary>
    Task LockUserAccountsAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Stages a new account; it is written by <see cref="TrySaveChangesAsync"/>.</summary>
    void Add(Account account);

    /// <summary>
    /// Saves pending changes. Returns false, and discards the changes, when the database rejected them
    /// because another active account of the user has the same name (e.g. a concurrent request won).
    /// </summary>
    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
