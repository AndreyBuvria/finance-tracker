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

    /// <summary>Stages a new budget; it is written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Add(Budget budget);

    /// <summary>Stages the removal of a budget; it is applied by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Remove(Budget budget);
}
