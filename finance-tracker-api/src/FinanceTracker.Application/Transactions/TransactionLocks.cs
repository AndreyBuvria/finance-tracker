using FinanceTracker.Application.Abstractions;

namespace FinanceTracker.Application.Transactions;

/// <summary>
/// The per-user locks taken by transaction writes, always in this order: categories (shared with category
/// archive/restore/delete/merge), then accounts (shared with account archive and transfer create/update).
/// One order everywhere means two writes of the same user can wait for each other but never deadlock.
/// Must be called inside a database transaction; the locks are released when it ends.
/// </summary>
internal static class TransactionLocks
{
    public static async Task AcquireAsync(
        ICategoryRepository categories,
        IAccountRepository accounts,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await categories.LockUserCategoriesAsync(userId, cancellationToken);
        await accounts.LockUserAccountsAsync(userId, cancellationToken);
    }

    /// <summary>
    /// Takes only the first lock of the order, the user's category lock, for writes that don't touch accounts
    /// (budget limits, which category merge sums).
    /// </summary>
    public static Task AcquireCategoriesAsync(
        ICategoryRepository categories,
        Guid userId,
        CancellationToken cancellationToken) =>
        categories.LockUserCategoriesAsync(userId, cancellationToken);
}
