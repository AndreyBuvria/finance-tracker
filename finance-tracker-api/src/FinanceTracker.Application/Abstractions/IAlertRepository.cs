using FinanceTracker.Application.Alerts;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Abstractions;

/// <summary>User-scoped alert persistence. Every method filters by <c>userId</c>; another user's alert is never found.</summary>
public interface IAlertRepository
{
    /// <summary>The user's alerts, newest first, optionally only unread ones, at most <paramref name="limit"/>.</summary>
    Task<IReadOnlyList<AlertRow>> ListAsync(
        Guid userId,
        bool unreadOnly,
        int limit,
        CancellationToken cancellationToken);

    /// <summary>How many of the user's alerts are unread.</summary>
    Task<int> CountUnreadAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Loads an alert for changes (tracked), or null when the user has no such alert.</summary>
    Task<Alert?> FindAsync(Guid userId, Guid alertId, CancellationToken cancellationToken);

    /// <summary>Marks every unread alert of the user read at <paramref name="readAt"/>; read ones keep their time.</summary>
    Task MarkAllReadAsync(Guid userId, DateTimeOffset readAt, CancellationToken cancellationToken);

    /// <summary>
    /// The levels that already have an alert in <paramref name="month"/> (first day), per category among
    /// <paramref name="categoryIds"/>.
    /// </summary>
    Task<IReadOnlySet<(Guid CategoryId, AlertLevel Level)>> ListExistingLevelsAsync(
        Guid userId,
        DateOnly month,
        IReadOnlyCollection<Guid> categoryIds,
        CancellationToken cancellationToken);

    /// <summary>Stages new alerts; they are written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void AddRange(IEnumerable<Alert> alerts);
}
