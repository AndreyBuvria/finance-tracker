namespace FinanceTracker.Domain.Entities;

/// <summary>Monthly spending limit for one expense category.</summary>
public sealed class Budget
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    /// <summary>First day of the budgeted calendar month.</summary>
    public DateOnly Month { get; set; }

    public decimal LimitAmount { get; set; }
}
