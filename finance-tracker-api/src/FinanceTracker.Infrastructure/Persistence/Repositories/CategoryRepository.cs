using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Categories;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class CategoryRepository(AppDbContext dbContext) : ICategoryRepository
{
    /// <summary>Unique (UserId, Type, NormalizedName) among non-archived categories.</summary>
    private const string _activeNameIndex = "IX_Categories_UserId_Type_NormalizedName";

    /// <summary>Transactions.CategoryId → Categories.Id (NO ACTION), which blocks deleting a used category.</summary>
    private const string _transactionCategoryForeignKey = "FK_Transactions_Categories_CategoryId";

    public async Task<IReadOnlyList<CategoryResponse>> ListAsync(
        Guid userId,
        bool includeArchived,
        CategoryType? type,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Categories
            .Where(c => c.UserId == userId
                && (includeArchived || !c.IsArchived)
                && (type == null || c.Type == type))
            // Type is stored as its name, so "Expense" sorts before "Income".
            .OrderBy(c => c.IsArchived)
            .ThenBy(c => c.Type)
            .ThenBy(c => EF.Property<string>(c, ConfigurationConstants.NormalizedName))
            .ThenBy(c => c.Id);

        return await WithCounts(query).ToListAsync(cancellationToken);
    }

    public Task<CategoryResponse?> GetAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken) =>
        WithCounts(dbContext.Categories.Where(c => c.UserId == userId && c.Id == categoryId))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<CategoryUsage>> ListActiveWithUsageAsync(
        Guid userId,
        CategoryType? type,
        DateOnly since,
        CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .Where(c => c.UserId == userId && !c.IsArchived && (type == null || c.Type == type))
            .Select(c => new CategoryUsage(
                new CategoryResponse(
                    c.Id,
                    c.Name,
                    c.Type,
                    c.Icon,
                    c.Color,
                    c.SystemKey,
                    c.IsArchived,
                    c.SystemKey == Category.OtherSystemKey || c.SystemKey == Category.OtherIncomeSystemKey,
                    dbContext.Transactions.Count(t => t.CategoryId == c.Id && t.UserId == c.UserId),
                    dbContext.Budgets.Count(b => b.CategoryId == c.Id && b.UserId == c.UserId)),
                dbContext.Transactions.Count(t => t.CategoryId == c.Id && t.UserId == c.UserId && t.Date >= since)))
            .ToListAsync(cancellationToken);
    }

    public Task<Category?> FindAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Categories.SingleOrDefaultAsync(c => c.UserId == userId && c.Id == categoryId, cancellationToken);

    public Task<bool> ActiveNameExistsAsync(
        Guid userId,
        CategoryType type,
        string name,
        Guid? exceptCategoryId,
        CancellationToken cancellationToken)
    {
        // lower(@name) in SQL matches the generated column lower("Name") behind the unique index exactly.
        // The index stays the final arbiter for concurrent requests (TrySaveChangesAsync).
        return dbContext.Categories.AnyAsync(
            c => c.UserId == userId
                && c.Type == type
                && !c.IsArchived
                && EF.Property<string>(c, ConfigurationConstants.NormalizedName) == PostgresFunctions.Lower(name)
                && (exceptCategoryId == null || c.Id != exceptCategoryId),
            cancellationToken);
    }

    public Task<bool> HasTransactionsAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Transactions.AnyAsync(t => t.UserId == userId && t.CategoryId == categoryId, cancellationToken);

    public Task<bool> IsInUseAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Categories
            .Where(c => c.UserId == userId && c.Id == categoryId)
            .AnyAsync(
                c => dbContext.Transactions.Any(t => t.UserId == userId && t.CategoryId == c.Id)
                    || dbContext.Budgets.Any(b => b.UserId == userId && b.CategoryId == c.Id)
                    || dbContext.CategoryRules.Any(r => r.UserId == userId && r.CategoryId == c.Id),
                cancellationToken);

    public Task LockUserCategoriesAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Transaction-scoped advisory lock keyed by the user, shared by every API instance and released on
        // commit/rollback. A hash collision with another user only serializes two unrelated changes briefly.
        var lockKey = $"categories:{userId}";
        return dbContext.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
            cancellationToken);
    }

    public Task<bool> MergedBudgetExceedsAsync(
        Guid userId,
        Guid sourceId,
        Guid targetId,
        decimal maxAmount,
        CancellationToken cancellationToken)
    {
        // Compared as "target > max - source" so the check itself can't overflow numeric(18,2).
        var sourceBudgets = dbContext.Budgets.Where(b => b.UserId == userId && b.CategoryId == sourceId);
        return dbContext.Budgets
            .Where(t => t.UserId == userId && t.CategoryId == targetId)
            .AnyAsync(
                t => sourceBudgets.Any(s => s.Month == t.Month && t.LimitAmount > maxAmount - s.LimitAmount),
                cancellationToken);
    }

    public async Task<CategoryMergeCounts> ReassignAsync(
        Guid userId,
        Guid sourceId,
        Guid targetId,
        CancellationToken cancellationToken)
    {
        var transactionsMoved = await dbContext.Transactions
            .Where(t => t.UserId == userId && t.CategoryId == sourceId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CategoryId, targetId), cancellationToken);

        // Budgets: one per category and month, so a month budgeted in both gets the limits summed
        // (FEATURES.md F5) and the source's row removed; the remaining source budgets simply move.
        var sourceBudgets = dbContext.Budgets.Where(b => b.UserId == userId && b.CategoryId == sourceId);
        var targetBudgets = dbContext.Budgets.Where(b => b.UserId == userId && b.CategoryId == targetId);

        await targetBudgets
            .Where(t => sourceBudgets.Any(s => s.Month == t.Month))
            .ExecuteUpdateAsync(
                s => s.SetProperty(
                    t => t.LimitAmount,
                    t => t.LimitAmount + sourceBudgets.Where(b => b.Month == t.Month).Select(b => b.LimitAmount).First()),
                cancellationToken);

        var budgetsSummed = await sourceBudgets
            .Where(s => targetBudgets.Any(t => t.Month == s.Month))
            .ExecuteDeleteAsync(cancellationToken);

        var budgetsMovedAsIs = await sourceBudgets
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.CategoryId, targetId), cancellationToken);

        var rulesMoved = await dbContext.CategoryRules
            .Where(r => r.UserId == userId && r.CategoryId == sourceId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CategoryId, targetId), cancellationToken);

        // Alerts describe the source's own budget usage, which no longer exists after the merge; carrying them
        // over would report the target at the wrong percentage. The target's status is recomputed by the
        // alerts logic on the next expense change.
        await dbContext.Alerts
            .Where(a => a.UserId == userId && a.CategoryId == sourceId)
            .ExecuteDeleteAsync(cancellationToken);

        return new CategoryMergeCounts(transactionsMoved, budgetsSummed + budgetsMovedAsIs, rulesMoved);
    }

    public void Add(Category category) => dbContext.Categories.Add(category);

    public void AddRange(IEnumerable<Category> categories) => dbContext.Categories.AddRange(categories);

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

    public async Task<bool> TryDeleteAsync(Category category, CancellationToken cancellationToken)
    {
        // Budgets, rules and alerts of the category go with it (ON DELETE CASCADE); transactions block it.
        dbContext.Categories.Remove(category);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (PostgresErrors.IsForeignKeyViolation(ex, _transactionCategoryForeignKey))
        {
            dbContext.ChangeTracker.Clear();
            return false;
        }
    }

    /// <summary>
    /// Projects categories with their transaction and budget counts, computed by PostgreSQL (correlated COUNTs
    /// using the CategoryId indexes).
    /// </summary>
    private IQueryable<CategoryResponse> WithCounts(IQueryable<Category> categories) =>
        categories
            .AsNoTracking()
            .Select(c => new CategoryResponse(
                c.Id,
                c.Name,
                c.Type,
                c.Icon,
                c.Color,
                c.SystemKey,
                c.IsArchived,
                c.SystemKey == Category.OtherSystemKey || c.SystemKey == Category.OtherIncomeSystemKey,
                dbContext.Transactions.Count(t => t.CategoryId == c.Id && t.UserId == c.UserId),
                dbContext.Budgets.Count(b => b.CategoryId == c.Id && b.UserId == c.UserId)));
}
