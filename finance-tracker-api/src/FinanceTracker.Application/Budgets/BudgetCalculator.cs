using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Rules;

namespace FinanceTracker.Application.Budgets;

/// <summary>
/// The single place for budget usage (PLAN.md §6 Budgets, FEATURES.md F6), shared by the Budgets page, the
/// dashboard and the alerts. Spending is grouped and summed by PostgreSQL; only the per-category results (a few
/// dozen rows) are combined here.
/// <list type="bullet">
/// <item>Spent per category = expenses − refunds, floored at 0; transfers are excluded; archived accounts count.</item>
/// <item>Budgeted items = active expense categories with a limit. Hidden categories' budgets are ignored.</item>
/// <item>Unbudgeted = active expense categories without a limit (also with nothing spent) plus hidden expense
/// categories with spending, so the Budgets total spent matches Transactions.</item>
/// <item>Items and unbudgeted categories follow the database name order of <c>GET /categories</c>.</item>
/// <item>Totals over the items; daily allowance only for the current Europe/Warsaw month.</item>
/// </list>
/// </summary>
public sealed class BudgetCalculator(IBudgetRepository budgets, BusinessClock clock)
{
    /// <summary>Everything the Budgets page shows for one month (<paramref name="month"/> is its first day).</summary>
    public async Task<BudgetMonthResponse> CalculateMonthAsync(
        Guid userId,
        DateOnly month,
        CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var period = BusinessClock.PeriodOf(month, today);
        int? daysLeft = period == MonthPeriod.Current ? BusinessClock.DaysLeftInMonth(today) : null;

        // Already ordered by name by the database.
        var byName = await budgets.ListExpenseCategoriesAsync(userId, month, null, cancellationToken);
        var spending = await budgets.SumSpendingByCategoryAsync(userId, month, null, cancellationToken);
        var canCopy = await budgets.AnyCopyableAsync(userId, month.AddMonths(-1), month, cancellationToken);

        var items = byName
            .Where(IsBudgeted)
            .Select(r => ToItem(r, SpentOf(r, spending)))
            .ToList();

        // A stable sort keeps the name order among equal amounts.
        var unbudgetedItems = byName
            .Where(r => !IsBudgeted(r))
            .Select(r => new UnbudgetedItemResponse(
                new UnbudgetedCategoryResponse(r.Id, r.Name, r.Icon, r.Color, r.IsArchived),
                SpentOf(r, spending)))
            .Where(u => !u.Category.IsArchived || u.Spent > 0m)
            .OrderByDescending(u => u.Spent)
            .ToList();

        var unbudgeted = new UnbudgetedResponse(unbudgetedItems.Sum(u => u.Spent), unbudgetedItems);

        return new BudgetMonthResponse(
            CalendarMonth.ToText(month),
            period,
            daysLeft,
            items,
            unbudgeted,
            Totals(items, daysLeft),
            canCopy);
    }

    /// <summary>
    /// Usage of the given categories in one month (<paramref name="month"/> is its first day), keyed by category ID.
    /// Only categories that count as budgeted that month (active expense categories with a limit) are present; a
    /// category without a budget has no status. Used by the alerts to compare statuses before and after a change.
    /// </summary>
    public async Task<IReadOnlyDictionary<Guid, BudgetItemResponse>> CalculateCategoriesAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken)
    {
        if (categoryIds.Count == 0)
        {
            return new Dictionary<Guid, BudgetItemResponse>();
        }

        var rows = await budgets.ListExpenseCategoriesAsync(userId, month, categoryIds, cancellationToken);
        var budgeted = rows.Where(IsBudgeted).ToList();
        if (budgeted.Count == 0)
        {
            return new Dictionary<Guid, BudgetItemResponse>();
        }

        var spending = await budgets.SumSpendingByCategoryAsync(
            userId,
            month,
            [.. budgeted.Select(r => r.Id)],
            cancellationToken);

        return budgeted.ToDictionary(r => r.Id, r => ToItem(r, SpentOf(r, spending)));
    }

    private static bool IsBudgeted(BudgetCategoryRow row) => !row.IsArchived && row.LimitAmount is not null;

    private static decimal SpentOf(BudgetCategoryRow row, IReadOnlyDictionary<Guid, decimal> spending) =>
        BudgetUsageRules.FloorSpent(spending.GetValueOrDefault(row.Id));

    private static BudgetItemResponse ToItem(BudgetCategoryRow row, decimal spent)
    {
        var limit = row.LimitAmount!.Value;
        return new BudgetItemResponse(
            new BudgetCategoryResponse(row.Id, row.Name, row.Icon, row.Color),
            limit,
            spent,
            limit - spent,
            BudgetUsageRules.UsageOf(spent, limit),
            BudgetUsageRules.StatusOf(spent, limit));
    }

    private static BudgetTotalsResponse? Totals(IReadOnlyList<BudgetItemResponse> items, int? daysLeft)
    {
        if (items.Count == 0)
        {
            return null;
        }

        var limit = items.Sum(i => i.LimitAmount);
        var spent = items.Sum(i => i.Spent);
        var remaining = limit - spent;

        return new BudgetTotalsResponse(
            limit,
            spent,
            remaining,
            BudgetUsageRules.UsageOf(spent, limit),
            BudgetUsageRules.StatusOf(spent, limit),
            daysLeft is { } days ? BudgetUsageRules.DailyAllowance(remaining, days) : null);
    }
}
