using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Constants;

/// <summary>One default category copied to every new user (PLAN.md §5).</summary>
public sealed record DefaultCategory(string SystemKey, string Name, CategoryType Type, string Icon, string Color);

/// <summary>
/// The default categories seeded for each user at registration. This is the single source of
/// truth for the list; clients read categories from the API and never hard-code it.
/// </summary>
public static class DefaultCategories
{
    public static readonly IReadOnlyList<DefaultCategory> All =
    [
        new("groceries", "Groceries", CategoryType.Expense, "shopping_cart", CategoryPalette.Green),
        new("eating_out", "Eating out", CategoryType.Expense, "restaurant", CategoryPalette.Orange),
        new("transport", "Transport", CategoryType.Expense, "directions_bus", CategoryPalette.Blue),
        new("housing", "Housing", CategoryType.Expense, "home", CategoryPalette.Brown),
        new("utilities", "Utilities", CategoryType.Expense, "bolt", CategoryPalette.Yellow),
        new("health", "Health", CategoryType.Expense, "medical_services", CategoryPalette.Red),
        new("shopping", "Shopping", CategoryType.Expense, "shopping_bag", CategoryPalette.Pink),
        new("entertainment", "Entertainment", CategoryType.Expense, "movie", CategoryPalette.Purple),
        new("subscriptions", "Subscriptions", CategoryType.Expense, "subscriptions", CategoryPalette.Indigo),
        new(Category.OtherSystemKey, "Other", CategoryType.Expense, "category", CategoryPalette.BlueGrey),
        new("salary", "Salary", CategoryType.Income, "payments", CategoryPalette.Cyan),
        new("other_income", "Other income", CategoryType.Income, "savings", CategoryPalette.Lime),
    ];

    /// <summary>Creates the user's own copies of all default categories.</summary>
    public static IReadOnlyList<Category> CreateFor(Guid userId) =>
        [
            .. All.Select(d => new Category
            {
                UserId = userId,
                Name = d.Name,
                Type = d.Type,
                Icon = d.Icon,
                Color = d.Color,
                SystemKey = d.SystemKey,
            }),
        ];
}
