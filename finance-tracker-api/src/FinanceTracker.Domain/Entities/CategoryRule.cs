using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>User-defined auto-categorization rule applied to imported transactions.</summary>
public sealed class CategoryRule
{
    public const int PatternMaxLength = 100;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>Normalized merchant pattern (case- and accent-insensitive matching).</summary>
    public required string Pattern { get; set; }

    public RuleMatchType MatchType { get; set; }

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    public int Priority { get; set; }
}
