using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>
/// Raised when a category's budget status crosses a threshold upward.
/// At most one alert per user, category, month and level.
/// </summary>
public sealed class Alert
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    /// <summary>First day of the calendar month the alert is about.</summary>
    public DateOnly Month { get; set; }

    public AlertLevel Level { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ReadAt { get; set; }
}
