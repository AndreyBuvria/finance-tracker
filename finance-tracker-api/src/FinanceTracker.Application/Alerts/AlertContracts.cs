using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Alerts;

/// <summary>Query string of <c>GET /alerts</c>.</summary>
public sealed record AlertListQuery
{
    /// <summary>Only alerts that haven't been read yet.</summary>
    public bool UnreadOnly { get; init; }

    /// <summary>How many alerts to return, 1–50 (default 20).</summary>
    public int? Limit { get; init; }
}

/// <summary>The category an alert is about.</summary>
public sealed record AlertCategoryResponse(Guid Id, string Name, string Icon, string Color);

/// <summary>
/// A budget alert (FEATURES.md F8). The client builds its text from the snapshot: Warning "{Category} is at
/// {percent}% — {amount} left for {daysLeft} days."; Over "{Category} is over budget by {amount}."
/// </summary>
/// <param name="Id">The alert.</param>
/// <param name="Level">Warning (80% reached) or Over (100% reached).</param>
/// <param name="Month">The budget month as <c>YYYY-MM</c>.</param>
/// <param name="Category">The category whose budget crossed the threshold.</param>
/// <param name="Percent">Spent ÷ limit as a whole percentage (rounded down) when the alert was created.</param>
/// <param name="Amount">Remaining for a Warning, the over-budget amount for an Over; never negative.</param>
/// <param name="DaysLeft">Days left in the month when the alert was created, that day included.</param>
/// <param name="CreatedAt">When the alert was created (UTC).</param>
/// <param name="ReadAt">When it was first marked read (UTC), or null while unread.</param>
public sealed record AlertResponse(
    Guid Id,
    AlertLevel Level,
    string Month,
    AlertCategoryResponse Category,
    int Percent,
    decimal Amount,
    int DaysLeft,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

/// <summary>Result of <c>GET /alerts</c>.</summary>
/// <param name="Items">The alerts, newest first.</param>
/// <param name="UnreadCount">All unread alerts of the user, whatever the filter and limit.</param>
public sealed record AlertListResponse(IReadOnlyList<AlertResponse> Items, int UnreadCount);

/// <summary>An alert as stored, before its month is formatted for the API.</summary>
public sealed record AlertRow(
    Guid Id,
    AlertLevel Level,
    DateOnly Month,
    AlertCategoryResponse Category,
    int Percent,
    decimal Amount,
    int DaysLeft,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

/// <summary>
/// A row whose spending a write adds, removes or moves: its expense category (null for transfers) and its date.
/// Each changed row is passed with its old values and, when it still exists, its new values.
/// </summary>
public readonly record struct SpendingChange(Guid? CategoryId, DateOnly Date);
