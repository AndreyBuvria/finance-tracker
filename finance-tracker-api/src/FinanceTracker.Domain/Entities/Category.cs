using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>
/// A user-owned category. Defaults are copied to every user on registration and carry a
/// <see cref="SystemKey"/> that survives renames; custom categories have no system key.
/// </summary>
public sealed class Category
{
    public const int NameMaxLength = 30;
    public const int IconMaxLength = 50;
    public const int ColorLength = 7;
    public const int SystemKeyMaxLength = 50;

    /// <summary>System key of the fallback category that can't be hidden or merged.</summary>
    public const string OtherSystemKey = "other";

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Name { get; set; }

    public CategoryType Type { get; set; }

    /// <summary>Material Symbols Rounded icon name from the fixed icon set.</summary>
    public required string Icon { get; set; }

    /// <summary>Lowercase hex color <c>#rrggbb</c> from the fixed 12-color palette.</summary>
    public required string Color { get; set; }

    /// <summary>snake_case key of a default category (e.g. <c>eating_out</c>); null for custom ones.</summary>
    public string? SystemKey { get; set; }

    public bool IsArchived { get; set; }
}
