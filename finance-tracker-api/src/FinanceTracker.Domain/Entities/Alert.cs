using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>
/// Raised when a category's budget status crosses a threshold upward.
/// At most one alert per user, category, month and level. <see cref="Percent"/>, <see cref="Amount"/> and
/// <see cref="DaysLeft"/> are a snapshot taken when the alert is created, so its text never changes later.
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

    /// <summary>Spent ÷ limit as a whole percentage, rounded down (e.g. 92), when the alert was created.</summary>
    public int Percent { get; set; }

    /// <summary>
    /// What was left of the limit for a Warning, or how much the spending exceeded it for an Over; never negative.
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>Days left in the month when the alert was created, that day included.</summary>
    public int DaysLeft { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ReadAt { get; set; }
}
