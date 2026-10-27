using FinanceTracker.Application.Budgets;
using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Application.Abstractions;

/// <summary>User-scoped budget persistence. Every method filters by <c>userId</c>; another user's budget is never found.</summary>
public interface IBudgetRepository
{
    /// <summary>
    /// Loads the budget of one category and month for changes (tracked), or null when there is none.
    /// <paramref name="month"/> is the first day of the month.
    /// </summary>
    Task<Budget?> FindAsync(Guid userId, Guid categoryId, DateOnly month, CancellationToken cancellationToken);

    /// <summary>
    /// The user's expense categories (active and hidden) with their limit in <paramref name="month"/> (first day),
    /// optionally only those in <paramref name="categoryIds"/>. One row per category, ordered by lower-case name
    /// with the database collation (the order of <c>GET /categories</c>), then by ID.
    /// </summary>
    Task<IReadOnlyList<BudgetCategoryRow>> ListExpenseCategoriesAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid>? categoryIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Expenses − refunds (income in an expense category) per expense category for transactions dated in
    /// <paramref name="month"/> (first day), optionally only for <paramref name="categoryIds"/>. Grouped and summed by
    /// PostgreSQL; transfers are excluded; archived accounts count. The sums are not floored, so they may be
    /// negative. Categories without such transactions are absent.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, decimal>> SumSpendingByCategoryAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid>? categoryIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// The limits of <paramref name="from"/> that a copy into <paramref name="to"/> would create: those of active
    /// expense categories that have no limit in <paramref name="to"/> yet (both months are first days).
    /// </summary>
    Task<IReadOnlyList<Budget>> ListCopyableAsync(
        Guid userId,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken);

    /// <summary>
    /// Whether a copy from <paramref name="from"/> into <paramref name="to"/> would create at least one limit (the
    /// same rule as <see cref="ListCopyableAsync"/>).
    /// </summary>
    Task<bool> AnyCopyableAsync(Guid userId, DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>Stages a new budget; it is written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Add(Budget budget);

    /// <summary>Stages new budgets; they are written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void AddRange(IEnumerable<Budget> budgets);

    /// <summary>Stages the removal of a budget; it is applied by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Remove(Budget budget);
}
