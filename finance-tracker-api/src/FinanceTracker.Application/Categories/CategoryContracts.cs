using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Categories;

/// <summary>Body of <c>POST /categories</c> and <c>PUT /categories/{id}</c>.</summary>
/// <param name="Name">Required, at most 30 characters (trimmed), unique among the user's active categories of the same type.</param>
/// <param name="Type">Expense or Income. Can't change for a default category or for one that is already in use.</param>
/// <param name="Icon">A Material Symbols Rounded name from the fixed icon set.</param>
/// <param name="Color">A <c>#rrggbb</c> color from the fixed 12-color palette (any letter case; stored lowercase).</param>
public sealed record CategoryRequest(string Name, CategoryType? Type, string? Icon, string? Color);

/// <summary>A category with the usage counts the settings screen needs for delete/merge decisions.</summary>
/// <param name="Id">Category ID.</param>
/// <param name="Name">Display name (renamable, also for defaults).</param>
/// <param name="Type">Expense or Income.</param>
/// <param name="Icon">Material Symbols Rounded name from the fixed icon set.</param>
/// <param name="Color">Lowercase <c>#rrggbb</c> from the fixed palette.</param>
/// <param name="SystemKey">Key of a default category (e.g. <c>groceries</c>); null for custom categories.</param>
/// <param name="IsArchived">Hidden/archived (or merged away): not offered in pickers, history kept.</param>
/// <param name="IsProtected">
/// True for the import fallbacks ("Other", "Other income"): they can't be hidden, merged or deleted.
/// </param>
/// <param name="TransactionCount">All of the user's transactions in this category (any date).</param>
/// <param name="BudgetCount">Monthly budgets set for this category (any month).</param>
public sealed record CategoryResponse(
    Guid Id,
    string Name,
    CategoryType Type,
    string Icon,
    string Color,
    string? SystemKey,
    bool IsArchived,
    bool IsProtected,
    int TransactionCount,
    int BudgetCount);

/// <summary>Result of <c>GET /categories</c> and <c>GET /categories/top</c>.</summary>
public sealed record CategoryListResponse(IReadOnlyList<CategoryResponse> Items);

/// <summary>Body of <c>POST /categories/{id}/merge</c>.</summary>
/// <param name="TargetCategoryId">The active category of the same type that receives everything.</param>
public sealed record MergeCategoryRequest(Guid? TargetCategoryId);

/// <summary>What a merge moved into the target category; the source is archived afterwards.</summary>
/// <param name="TransactionsMoved">Transactions recategorized to the target.</param>
/// <param name="BudgetsMoved">Source budgets moved or added to a target budget of the same month.</param>
/// <param name="RulesMoved">Auto-categorization rules now pointing at the target.</param>
/// <param name="Target">The target category with its updated counts.</param>
public sealed record MergeCategoryResponse(
    int TransactionsMoved,
    int BudgetsMoved,
    int RulesMoved,
    CategoryResponse Target);

/// <summary>Counts of rows a merge reassigned (internal to the use case).</summary>
public sealed record CategoryMergeCounts(int TransactionsMoved, int BudgetsMoved, int RulesMoved);

/// <summary>An active category and how many transactions used it within the "top used" window.</summary>
public sealed record CategoryUsage(CategoryResponse Category, int UsageCount);

/// <summary>Query string of <c>GET /categories</c>.</summary>
public sealed record CategoryListQuery
{
    /// <summary>Also list archived (hidden or merged-away) categories, after the active ones.</summary>
    public bool IncludeArchived { get; init; }

    /// <summary>Only categories of this type (Expense or Income); all when omitted.</summary>
    public CategoryType? Type { get; init; }
}

/// <summary>Query string of <c>GET /categories/top</c>.</summary>
public sealed record TopCategoriesQuery
{
    /// <summary>How many categories to return, 1–50 (default 8).</summary>
    public int? Limit { get; init; }

    /// <summary>Only categories of this type (Expense or Income); all when omitted.</summary>
    public CategoryType? Type { get; init; }
}
