using System.Collections.Frozen;

namespace FinanceTracker.Domain.Constants;

/// <summary>
/// The fixed 12-color category palette (PLAN.md §5). Values are lowercase <c>#rrggbb</c> and must
/// stay in sync with the frontend copy in <c>category-palette.constants.ts</c>.
/// </summary>
public static class CategoryPalette
{
    public const string Red = "#c62828";
    public const string Pink = "#ad1457";
    public const string Purple = "#7b1fa2";
    public const string Indigo = "#3949ab";
    public const string Blue = "#1565c0";
    public const string Cyan = "#00838f";
    public const string Green = "#2e7d32";
    public const string Lime = "#c0ca33";
    public const string Yellow = "#fbc02d";
    public const string Orange = "#ef6c00";
    public const string Brown = "#6d4c41";
    public const string BlueGrey = "#546e7a";

    /// <summary>All palette colors in display order.</summary>
    public static readonly IReadOnlyList<string> All =
    [
        Red, Pink, Purple, Indigo, Blue, Cyan, Green, Lime, Yellow, Orange, Brown, BlueGrey,
    ];

    private static readonly FrozenSet<string> _allowed = All.ToFrozenSet(StringComparer.Ordinal);

    /// <summary>True when <paramref name="color"/> is exactly one of the palette values.</summary>
    public static bool Contains(string? color) => color is not null && _allowed.Contains(color);
}
