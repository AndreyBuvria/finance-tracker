using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Application.Abstractions;

/// <summary>
/// User-scoped transaction persistence. Every method filters by <c>userId</c>; another user's transaction is never
/// found, listed or changed.
/// </summary>
public interface ITransactionRepository
{
    /// <summary>
    /// One page of table rows plus the count and totals of the whole filtered set, all computed by PostgreSQL.
    /// A transfer appears once (its Out row). <paramref name="offset"/> may exceed the set (empty page).
    /// </summary>
    Task<TransactionPage> ListAsync(
        Guid userId,
        TransactionFilter filter,
        TransactionSort sort,
        long offset,
        int limit,
        CancellationToken cancellationToken);

    /// <summary>One transaction as a table row, or null when the user has no such transaction.</summary>
    Task<TransactionResponse?> GetAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken);

    /// <summary>A transfer as a table row (its Out side), or null when the user has no such pair.</summary>
    Task<TransactionResponse?> GetTransferAsync(Guid userId, Guid transferPairId, CancellationToken cancellationToken);

    /// <summary>
    /// The user's merchants (expenses and income) whose name contains <paramref name="search"/> accent- and
    /// case-insensitively, names starting with it first, then most recently used.
    /// </summary>
    Task<IReadOnlyList<MerchantSuggestion>> ListMerchantsAsync(
        Guid userId,
        string? search,
        int limit,
        CancellationToken cancellationToken);

    /// <summary>Loads the transaction for changes (tracked), or null when the user has no such transaction.</summary>
    Task<Transaction?> FindAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken);

    /// <summary>Loads both rows of a transfer for changes (tracked); empty when the user has no such pair.</summary>
    Task<IReadOnlyList<Transaction>> FindTransferAsync(
        Guid userId,
        Guid transferPairId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Type, pair, category and date of each of the user's transactions among <paramref name="transactionIds"/>.
    /// </summary>
    Task<IReadOnlyList<TransactionHeader>> ListHeadersAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes the user's transactions with these IDs plus every row of these transfer pairs. Imported rows leave a
    /// <c>DeletedImportHash</c> tombstone so re-importing the statement doesn't restore them. Must run inside a
    /// transaction. Returns the number of rows deleted.
    /// </summary>
    Task<int> DeleteAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        IReadOnlyCollection<Guid> transferPairIds,
        CancellationToken cancellationToken);

    /// <summary>Moves the user's transactions with these IDs to the category. Returns the number of rows updated.</summary>
    Task<int> RecategorizeAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        Guid categoryId,
        CancellationToken cancellationToken);

    /// <summary>Stages new transactions; they are written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Add(params Transaction[] transactions);
}
