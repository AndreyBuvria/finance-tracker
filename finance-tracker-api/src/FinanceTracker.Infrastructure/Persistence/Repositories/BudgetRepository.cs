using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Domain.Rules;
using FinanceTracker.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class BudgetRepository(AppDbContext dbContext) : IBudgetRepository
{
    public Task<Budget?> FindAsync(Guid userId, Guid categoryId, DateOnly month, CancellationToken cancellationToken) =>
        dbContext.Budgets.SingleOrDefaultAsync(
            b => b.UserId == userId && b.CategoryId == categoryId && b.Month == month,
            cancellationToken);

    public async Task<IReadOnlyList<BudgetCategoryRow>> ListExpenseCategoriesAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid>? categoryIds,
        CancellationToken cancellationToken)
    {
        // At most one budget per (user, category, month), so the correlated subquery yields one value or NULL.
        return await dbContext.Categories
            .AsNoTracking()
            .Where(c => c.UserId == userId
                && c.Type == CategoryType.Expense
                && (categoryIds == null || categoryIds.Contains(c.Id)))
            .OrderBy(c => EF.Property<string>(c, ConfigurationConstants.NormalizedName))
            .ThenBy(c => c.Id)
            .Select(c => new BudgetCategoryRow(
                c.Id,
                c.Name,
                c.Icon,
                c.Color,
                c.IsArchived,
                dbContext.Budgets
                    .Where(b => b.UserId == userId && b.CategoryId == c.Id && b.Month == month)
                    .Select(b => (decimal?)b.LimitAmount)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> SumSpendingByCategoryAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid>? categoryIds,
        CancellationToken cancellationToken)
    {
        var nextMonth = month.AddMonths(1);

        // Expenses always use expense categories; income in an expense category is a refund. Transfers have no
        // category, so the category join drops them; they are also excluded explicitly. Uses (UserId, Date).
        var sums = await dbContext.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId
                && t.Date >= month
                && t.Date < nextMonth
                && t.Type != TransactionType.Transfer
                && t.CategoryId != null
                && t.Category!.Type == CategoryType.Expense
                && (categoryIds == null || categoryIds.Contains(t.CategoryId.Value)))
            .GroupBy(t => t.CategoryId!.Value, BudgetUsageRules.SignedSpending)
            .Select(g => new { CategoryId = g.Key, Spending = g.Sum() })
            .ToListAsync(cancellationToken);

        return sums.ToDictionary(s => s.CategoryId, s => s.Spending);
    }

    public async Task<IReadOnlyList<Budget>> ListCopyableAsync(
        Guid userId,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken) =>
        await Copyable(userId, from, to).AsNoTracking().ToListAsync(cancellationToken);

    public Task<bool> AnyCopyableAsync(Guid userId, DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        Copyable(userId, from, to).AnyAsync(cancellationToken);

    public void Add(Budget budget) => dbContext.Budgets.Add(budget);

    public void AddRange(IEnumerable<Budget> budgets) => dbContext.Budgets.AddRange(budgets);

    public void Remove(Budget budget) => dbContext.Budgets.Remove(budget);

    /// <summary>Limits of <paramref name="from"/> for active expense categories without a limit in <paramref name="to"/>.</summary>
    private IQueryable<Budget> Copyable(Guid userId, DateOnly from, DateOnly to) =>
        dbContext.Budgets.Where(b => b.UserId == userId
            && b.Month == from
            && b.Category.Type == CategoryType.Expense
            && !b.Category.IsArchived
            && !dbContext.Budgets.Any(t => t.UserId == userId && t.CategoryId == b.CategoryId && t.Month == to));
}
