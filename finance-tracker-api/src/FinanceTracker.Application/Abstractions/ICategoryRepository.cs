using FinanceTracker.Application.Categories;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Abstractions;

/// <summary>User-scoped category persistence. Every method filters by <c>userId</c>; another user's category is never found.</summary>
public interface ICategoryRepository
{
    /// <summary>
    /// The user's categories with usage counts: active ones first, then expense before income, then by name.
    /// Archived categories are included only when <paramref name="includeArchived"/> is true.
    /// </summary>
    Task<IReadOnlyList<CategoryResponse>> ListAsync(
        Guid userId,
        bool includeArchived,
        CategoryType? type,
        CancellationToken cancellationToken);

    /// <summary>One category with its usage counts, or null when the user has no such category.</summary>
    Task<CategoryResponse?> GetAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken);

    /// <summary>
    /// The user's active categories (optionally of one type), each with the number of transactions dated on or
    /// after <paramref name="since"/>. Counted in the database; the caller orders and trims the list.
    /// </summary>
    Task<IReadOnlyList<CategoryUsage>> ListActiveWithUsageAsync(
        Guid userId,
        CategoryType? type,
        DateOnly since,
        CancellationToken cancellationToken);

    /// <summary>Loads the category for changes (tracked), or null when the user has no such category.</summary>
    Task<Category?> FindAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken);

    /// <summary>Whether another active category of the user with this type already has this name, ignoring case.</summary>
    Task<bool> ActiveNameExistsAsync(
        Guid userId,
        CategoryType type,
        string name,
        Guid? exceptCategoryId,
        CancellationToken cancellationToken);

    Task<bool> HasTransactionsAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken);

    /// <summary>Whether any transaction, budget or rule of the user points at the category.</summary>
    Task<bool> IsInUseAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken);

    /// <summary>
    /// Takes a database lock, held until the current transaction ends, that serializes changes to one user's
    /// categories (archive, restore, delete, merge, type change) across all API instances. Must be called inside
    /// a transaction.
    /// </summary>
    Task LockUserCategoriesAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether summing the source's and the target's budgets of the same month would exceed
    /// <paramref name="maxAmount"/> for any month (checked in the database before a merge).
    /// </summary>
    Task<bool> MergedBudgetExceedsAsync(
        Guid userId,
        Guid sourceId,
        Guid targetId,
        decimal maxAmount,
        CancellationToken cancellationToken);

    /// <summary>
    /// Reassigns everything of <paramref name="sourceId"/> to <paramref name="targetId"/> with set-based updates:
    /// transactions and rules move; a source budget is added to the target's budget of the same month or moved
    /// when the target has none; the source's alerts are deleted. Must run inside a transaction.
    /// </summary>
    Task<CategoryMergeCounts> ReassignAsync(
        Guid userId,
        Guid sourceId,
        Guid targetId,
        CancellationToken cancellationToken);

    /// <summary>Stages a new category; it is written by <see cref="TrySaveChangesAsync"/>.</summary>
    void Add(Category category);

    /// <summary>Stages new categories; they are written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void AddRange(IEnumerable<Category> categories);

    /// <summary>
    /// Saves pending changes. Returns false, and discards the changes, when the database rejected them because
    /// another active category of the user with the same type has the same name (e.g. a concurrent request won).
    /// </summary>
    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Deletes the category together with its budgets, rules and alerts. Returns false, and deletes nothing,
    /// when the database refused because a transaction still references it (e.g. one added concurrently).
    /// </summary>
    Task<bool> TryDeleteAsync(Category category, CancellationToken cancellationToken);
}
