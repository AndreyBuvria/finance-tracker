using System.Collections.Frozen;

namespace FinanceTracker.Domain.Constants;

/// <summary>
/// The fixed set of 40 category icons: Material Symbols Rounded names (PLAN.md §5). Must stay in
/// sync with the frontend copy in <c>category-icons.constants.ts</c>.
/// </summary>
public static class CategoryIcons
{
    /// <summary>All allowed icon names in display order.</summary>
    public static readonly IReadOnlyList<string> All =
    [
        // Food and drink
        "shopping_cart",
        "restaurant",
        "local_cafe",
        "local_bar",
        "bakery_dining",
        // Transport
        "directions_bus",
        "directions_car",
        "local_taxi",
        "train",
        "local_gas_station",
        "flight",
        // Home and bills
        "home",
        "bolt",
        "water_drop",
        "wifi",
        "smartphone",
        "build",
        // Health and care
        "medical_services",
        "medication",
        "fitness_center",
        "spa",
        // Shopping
        "shopping_bag",
        "checkroom",
        "devices",
        "card_giftcard",
        // Leisure
        "movie",
        "sports_esports",
        "music_note",
        "subscriptions",
        "beach_access",
        "celebration",
        // Family, learning, pets
        "school",
        "menu_book",
        "child_care",
        "pets",
        "volunteer_activism",
        // Money
        "payments",
        "work",
        "savings",
        // Fallback
        "category",
    ];

    private static readonly FrozenSet<string> _allowed = All.ToFrozenSet(StringComparer.Ordinal);

    /// <summary>True when <paramref name="icon"/> is exactly one of the allowed icon names.</summary>
    public static bool Contains(string? icon) => icon is not null && _allowed.Contains(icon);
}
