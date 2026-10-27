using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Alerts;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class AlertRepository(AppDbContext dbContext) : IAlertRepository
{
    public async Task<IReadOnlyList<AlertRow>> ListAsync(
        Guid userId,
        bool unreadOnly,
        int limit,
        CancellationToken cancellationToken)
    {
        // Version 7 IDs grow with time, so they break ties between alerts created by the same write.
        return await dbContext.Alerts
            .AsNoTracking()
            .Where(a => a.UserId == userId && (!unreadOnly || a.ReadAt == null))
            .OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id)
            .Take(limit)
            .Select(a => new AlertRow(
                a.Id,
                a.Level,
                a.Month,
                new AlertCategoryResponse(a.Category.Id, a.Category.Name, a.Category.Icon, a.Category.Color),
                a.Percent,
                a.Amount,
                a.DaysLeft,
                a.CreatedAt,
                a.ReadAt))
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountUnreadAsync(Guid userId, CancellationToken cancellationToken) =>
        dbContext.Alerts.CountAsync(a => a.UserId == userId && a.ReadAt == null, cancellationToken);

    public Task<Alert?> FindAsync(Guid userId, Guid alertId, CancellationToken cancellationToken) =>
        dbContext.Alerts.SingleOrDefaultAsync(a => a.UserId == userId && a.Id == alertId, cancellationToken);

    public Task MarkAllReadAsync(Guid userId, DateTimeOffset readAt, CancellationToken cancellationToken) =>
        dbContext.Alerts
            .Where(a => a.UserId == userId && a.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ReadAt, readAt), cancellationToken);

    public async Task<IReadOnlySet<(Guid CategoryId, AlertLevel Level)>> ListExistingLevelsAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.Alerts
            .AsNoTracking()
            .Where(a => a.UserId == userId && a.Month == month && categoryIds.Contains(a.CategoryId))
            .Select(a => new { a.CategoryId, a.Level })
            .ToListAsync(cancellationToken);

        return rows.Select(r => (r.CategoryId, r.Level)).ToHashSet();
    }

    public void AddRange(IEnumerable<Alert> alerts) => dbContext.Alerts.AddRange(alerts);
}
