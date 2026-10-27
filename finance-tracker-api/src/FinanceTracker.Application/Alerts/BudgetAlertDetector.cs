using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Domain.Rules;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Alerts;

/// <summary>
/// Creates budget alerts when a write pushes a category's status across a threshold (PLAN.md §6 Alerts,
/// FEATURES.md F8). Every expense-affecting write (transaction create/update/delete, bulk delete/recategorize,
/// category merge, and the Phase 4 import) uses it the same way, inside its database transaction and under the
/// user's category lock:
/// <list type="number">
/// <item><see cref="CaptureAsync"/> (or <see cref="CaptureCategoriesAsync"/>) before the write changes anything;</item>
/// <item>the write, including <see cref="IUnitOfWork.SaveChangesAsync"/>;</item>
/// <item><see cref="CreateCrossingAlertsAsync"/>, then commit.</item>
/// </list>
/// Only the current Europe/Warsaw month is checked. A category counts only when it is budgeted both before and after
/// (an active expense category with a limit), so hidden and unbudgeted categories never alert and a limit appearing
/// never does either. OK → Warning creates a Warning; OK or Warning → Over creates only an Over; downward moves create
/// nothing. At most one alert per category, month and level: an existing one is never repeated.
/// </summary>
public sealed partial class BudgetAlertDetector(
    BudgetCalculator calculator,
    IAlertRepository alerts,
    IUnitOfWork unitOfWork,
    BusinessClock clock,
    TimeProvider timeProvider,
    ILogger<BudgetAlertDetector> logger)
{
    /// <summary>
    /// Statuses before a write of the categories it touches in the current month. <paramref name="changes"/> lists
    /// every changed row with its old category and date and, when the row still exists afterwards, its new ones;
    /// rows without a category or dated outside the current month are ignored.
    /// </summary>
    public Task<BudgetStatusSnapshot> CaptureAsync(
        Guid userId,
        IEnumerable<SpendingChange> changes,
        CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var month = FirstDayOfMonth(today);
        var nextMonth = month.AddMonths(1);

        var categoryIds = changes
            .Where(c => c.CategoryId is not null && c.Date >= month && c.Date < nextMonth)
            .Select(c => c.CategoryId!.Value)
            .ToHashSet();

        return SnapshotAsync(userId, today, categoryIds, cancellationToken);
    }

    /// <summary>
    /// Statuses before a write of the given categories in the current month, whatever the dates of the changed
    /// rows (category merge moves every transaction of the source into the target).
    /// </summary>
    public Task<BudgetStatusSnapshot> CaptureCategoriesAsync(
        Guid userId,
        IEnumerable<Guid> categoryIds,
        CancellationToken cancellationToken) =>
        SnapshotAsync(userId, clock.Today, categoryIds.ToHashSet(), cancellationToken);

    /// <summary>
    /// Recomputes the captured categories after the write was saved and stages and saves an alert for each upward
    /// crossing that has no alert of that level yet. Must run in the same database transaction as the write.
    /// Returns the number of alerts created.
    /// </summary>
    public async Task<int> CreateCrossingAlertsAsync(BudgetStatusSnapshot before, CancellationToken cancellationToken)
    {
        if (before.Items.Count == 0)
        {
            return 0;
        }

        var after = await calculator.CalculateCategoriesAsync(
            before.UserId,
            before.Month,
            [.. before.Items.Keys],
            cancellationToken);

        var crossings = new List<(BudgetItemResponse Item, AlertLevel Level)>();
        foreach (var (categoryId, previous) in before.Items)
        {
            if (after.TryGetValue(categoryId, out var current) && CrossedLevel(previous.Status, current.Status) is { } level)
            {
                crossings.Add((current, level));
            }
        }

        if (crossings.Count == 0)
        {
            return 0;
        }

        var existing = await alerts.ListExistingLevelsAsync(
            before.UserId,
            before.Month,
            [.. crossings.Select(c => c.Item.Category.Id)],
            cancellationToken);

        var now = timeProvider.GetUtcNow();
        var daysLeft = BusinessClock.DaysLeftInMonth(before.Today);
        var created = crossings
            .Where(c => !existing.Contains((c.Item.Category.Id, c.Level)))
            .Select(c => new Alert
            {
                Id = Guid.CreateVersion7(now),
                UserId = before.UserId,
                CategoryId = c.Item.Category.Id,
                Month = before.Month,
                Level = c.Level,
                Percent = BudgetUsageRules.PercentOf(c.Item.Spent, c.Item.LimitAmount),
                Amount = SnapshotAmount(c.Item, c.Level),
                DaysLeft = daysLeft,
                CreatedAt = now,
            })
            .ToList();

        if (created.Count == 0)
        {
            return 0;
        }

        alerts.AddRange(created);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        LogCreated(before.UserId, created.Count, CalendarMonth.ToText(before.Month));
        return created.Count;
    }

    private async Task<BudgetStatusSnapshot> SnapshotAsync(
        Guid userId,
        DateOnly today,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken)
    {
        var month = FirstDayOfMonth(today);
        var items = await calculator.CalculateCategoriesAsync(userId, month, categoryIds, cancellationToken);
        return new BudgetStatusSnapshot(userId, today, month, items);
    }

    /// <summary>The level an upward move creates, or null for no move or a downward one.</summary>
    private static AlertLevel? CrossedLevel(BudgetStatus before, BudgetStatus after)
    {
        if (after <= before)
        {
            return null;
        }

        return after == BudgetStatus.Over ? AlertLevel.Over : AlertLevel.Warning;
    }

    /// <summary>Remaining for a Warning, the over-budget amount for an Over; kept within the money column.</summary>
    private static decimal SnapshotAmount(BudgetItemResponse item, AlertLevel level)
    {
        var amount = level == AlertLevel.Warning ? item.Remaining : -item.Remaining;
        return Math.Min(Math.Max(amount, 0m), Money.MaxAmount);
    }

    private static DateOnly FirstDayOfMonth(DateOnly date) => new(date.Year, date.Month, 1);

    [LoggerMessage(Level = LogLevel.Information, Message = "Created {Count} budget alert(s) for user {UserId} in {Month}")]
    private partial void LogCreated(Guid userId, int count, string month);
}

/// <summary>
/// Budget statuses of some categories in the current month, taken by <see cref="BudgetAlertDetector"/> before a
/// write. <see cref="Items"/> holds only categories that were budgeted at that moment.
/// </summary>
public sealed record BudgetStatusSnapshot(
    Guid UserId,
    DateOnly Today,
    DateOnly Month,
    IReadOnlyDictionary<Guid, BudgetItemResponse> Items);
