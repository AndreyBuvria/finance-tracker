using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Categories;

/// <summary>
/// Categories (FEATURES.md F5, PLAN.md §6): defaults can be renamed and hidden but never deleted; custom ones
/// with transactions are archived or merged; the import fallbacks ("Other", "Other income") always stay active.
/// Every state change runs under a per-user lock so concurrent archive/merge/delete requests can't interleave.
/// </summary>
public sealed partial class CategoryService(
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    BusinessClock clock,
    IValidator<CategoryRequest> validator,
    IValidator<MergeCategoryRequest> mergeValidator,
    IValidator<CategoryListQuery> listQueryValidator,
    IValidator<TopCategoriesQuery> topQueryValidator,
    ILogger<CategoryService> logger)
{
    /// <summary>Missing or another user's category; both look the same to the caller.</summary>
    public static readonly Error NotFound = Error.NotFound("Category not found", "This category doesn't exist.");

    public static readonly Error DuplicateName = Error.Conflict(
        "Category name taken",
        "A category with this name already exists.");

    public static readonly Error RestoreNameTaken = Error.Conflict(
        "Category name taken",
        "A category with this name already exists. Rename it first.");

    public static readonly Error FallbackCannotBeHidden = Error.Conflict(
        "Category can't be hidden",
        "This category can't be hidden. It collects transactions that don't fit anywhere else.");

    public static readonly Error FallbackCannotBeMerged = Error.Conflict(
        "Category can't be merged",
        "This category can't be merged. It collects transactions that don't fit anywhere else.");

    public static readonly Error FallbackCannotBeDeleted = Error.Conflict(
        "Category can't be deleted",
        "This category can't be deleted. It collects transactions that don't fit anywhere else.");

    public static readonly Error DefaultCannotBeDeleted = Error.Conflict(
        "Category can't be deleted",
        "Default categories can't be deleted. Hide them instead.");

    public static readonly Error HasTransactions = Error.Conflict(
        "Category has transactions",
        "This category has transactions. Archive it or merge it into another category instead.");

    public static readonly Error DefaultTypeLocked = Error.Conflict(
        "Category type can't change",
        "The type of a default category can't be changed.");

    public static readonly Error TypeLockedInUse = Error.Conflict(
        "Category type can't change",
        "This category is already in use, so its type can't be changed.");

    public static readonly Error MergedBudgetTooLarge = Error.Conflict(
        "Budgets can't be combined",
        "Merging would make a monthly budget too large. Lower one of the limits first.");

    /// <summary>The user's categories, optionally of one type; archived ones only when requested.</summary>
    public async Task<Result<CategoryListResponse>> ListAsync(
        Guid userId,
        CategoryListQuery query,
        CancellationToken cancellationToken)
    {
        var validation = await listQueryValidator.ValidateAsync(query, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        return new CategoryListResponse(
            await categories.ListAsync(userId, query.IncludeArchived, query.Type, cancellationToken));
    }

    /// <summary>
    /// The user's most-used active categories for the quick-add grid: by number of transactions in the last
    /// 90 days (today in Europe/Warsaw included), then defaults in their seeded order, then by name. Categories
    /// without recent use fill the remaining places, so a new user gets the defaults.
    /// </summary>
    public async Task<Result<CategoryListResponse>> ListTopAsync(
        Guid userId,
        TopCategoriesQuery query,
        CancellationToken cancellationToken)
    {
        var validation = await topQueryValidator.ValidateAsync(query, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var take = query.Limit ?? CategoryRules.TopDefaultLimit;
        var since = clock.Today.AddDays(-(CategoryRules.TopWindowDays - 1));
        var usages = await categories.ListActiveWithUsageAsync(userId, query.Type, since, cancellationToken);

        // At most a few dozen rows per user; the counting itself happened in PostgreSQL.
        var top = usages
            .OrderByDescending(u => u.UsageCount)
            .ThenBy(u => DefaultOrder(u.Category.SystemKey))
            .ThenBy(u => u.Category.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(u => u.Category.Id)
            .Take(take)
            .Select(u => u.Category)
            .ToList();

        return new CategoryListResponse(top);
    }

    public async Task<Result<CategoryResponse>> CreateAsync(
        Guid userId,
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var name = request.Name.Trim();
        var type = request.Type!.Value;
        if (await categories.ActiveNameExistsAsync(userId, type, name, null, cancellationToken))
        {
            return DuplicateName;
        }

        var category = new Category
        {
            Id = Guid.CreateVersion7(timeProvider.GetUtcNow()),
            UserId = userId,
            Name = name,
            Type = type,
            Icon = request.Icon!,
            Color = CategoryRules.NormalizeColor(request.Color)!,
        };
        categories.Add(category);

        if (!await categories.TrySaveChangesAsync(cancellationToken))
        {
            return DuplicateName;
        }

        LogCreated(userId, category.Id);

        // A new category is unused.
        return new CategoryResponse(
            category.Id,
            category.Name,
            category.Type,
            category.Icon,
            category.Color,
            SystemKey: null,
            IsArchived: false,
            IsProtected: false,
            TransactionCount: 0,
            BudgetCount: 0);
    }

    /// <summary>
    /// Renames or restyles a category, including an archived one (so a name clash on restore can be fixed).
    /// The type can change only for a custom category that no transaction, budget or rule uses yet.
    /// </summary>
    public async Task<Result<CategoryResponse>> UpdateAsync(
        Guid userId,
        Guid categoryId,
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        await using (var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await categories.LockUserCategoriesAsync(userId, cancellationToken);

            var category = await categories.FindAsync(userId, categoryId, cancellationToken);
            if (category is null)
            {
                return NotFound;
            }

            var validation = await validator.ValidateAsync(request, cancellationToken);
            if (!validation.IsValid)
            {
                return validation.ToError();
            }

            var name = request.Name.Trim();
            var type = request.Type!.Value;

            if (type != category.Type)
            {
                if (category.SystemKey is not null)
                {
                    return DefaultTypeLocked;
                }

                if (await categories.IsInUseAsync(userId, categoryId, cancellationToken))
                {
                    return TypeLockedInUse;
                }
            }

            // Names only need to be unique among active categories of the same type.
            if (!category.IsArchived
                && await categories.ActiveNameExistsAsync(userId, type, name, categoryId, cancellationToken))
            {
                return DuplicateName;
            }

            category.Name = name;
            category.Type = type;
            category.Icon = request.Icon!;
            category.Color = CategoryRules.NormalizeColor(request.Color)!;

            if (!await categories.TrySaveChangesAsync(cancellationToken))
            {
                return DuplicateName;
            }

            await transaction.CommitAsync(cancellationToken);
        }

        var updated = await categories.GetAsync(userId, categoryId, cancellationToken);
        return updated is null ? NotFound : updated;
    }

    /// <summary>
    /// Hides (archives) a category: it leaves the pickers but keeps its history. Idempotent.
    /// The import fallbacks can't be hidden.
    /// </summary>
    public async Task<Result> ArchiveAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken)
    {
        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await categories.LockUserCategoriesAsync(userId, cancellationToken);

        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return NotFound;
        }

        if (category.IsArchived)
        {
            return Result.Success();
        }

        if (Category.IsFallbackKey(category.SystemKey))
        {
            return FallbackCannotBeHidden;
        }

        category.IsArchived = true;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        LogArchived(userId, categoryId);
        return Result.Success();
    }

    /// <summary>Restores a hidden category. Idempotent. Fails when an active category of the same type uses its name.</summary>
    public async Task<Result> RestoreAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken)
    {
        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await categories.LockUserCategoriesAsync(userId, cancellationToken);

        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return NotFound;
        }

        if (!category.IsArchived)
        {
            return Result.Success();
        }

        if (await categories.ActiveNameExistsAsync(userId, category.Type, category.Name, categoryId, cancellationToken))
        {
            return RestoreNameTaken;
        }

        category.IsArchived = false;
        if (!await categories.TrySaveChangesAsync(cancellationToken))
        {
            return RestoreNameTaken;
        }

        await transaction.CommitAsync(cancellationToken);

        LogRestored(userId, categoryId);
        return Result.Success();
    }

    /// <summary>
    /// Hard-deletes a custom category that has no transactions, together with its budgets, rules and alerts.
    /// Defaults can only be hidden; a category with transactions must be archived or merged instead.
    /// </summary>
    public async Task<Result> DeleteAsync(Guid userId, Guid categoryId, CancellationToken cancellationToken)
    {
        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await categories.LockUserCategoriesAsync(userId, cancellationToken);

        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return NotFound;
        }

        if (Category.IsFallbackKey(category.SystemKey))
        {
            return FallbackCannotBeDeleted;
        }

        if (category.SystemKey is not null)
        {
            return DefaultCannotBeDeleted;
        }

        if (await categories.HasTransactionsAsync(userId, categoryId, cancellationToken))
        {
            return HasTransactions;
        }

        // The database still refuses if a transaction was added after the check (FK from Transactions).
        if (!await categories.TryDeleteAsync(category, cancellationToken))
        {
            return HasTransactions;
        }

        await transaction.CommitAsync(cancellationToken);

        LogDeleted(userId, categoryId);
        return Result.Success();
    }

    /// <summary>
    /// Merges a category into another active one of the same type, in one database transaction: moves all
    /// transactions and rules, adds each budget to the target's budget of the same month (or moves it when the
    /// target has none), drops the source's alerts, then archives the source.
    /// </summary>
    public async Task<Result<MergeCategoryResponse>> MergeAsync(
        Guid userId,
        Guid sourceId,
        MergeCategoryRequest request,
        CancellationToken cancellationToken)
    {
        CategoryMergeCounts counts;
        Guid targetId;

        await using (var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await categories.LockUserCategoriesAsync(userId, cancellationToken);

            var source = await categories.FindAsync(userId, sourceId, cancellationToken);
            if (source is null)
            {
                return NotFound;
            }

            var validation = await mergeValidator.ValidateAsync(request, cancellationToken);
            if (!validation.IsValid)
            {
                return validation.ToError();
            }

            targetId = request.TargetCategoryId!.Value;
            if (targetId == sourceId)
            {
                return MergeTargetError(CategoryRules.MergeTargetSame);
            }

            if (Category.IsFallbackKey(source.SystemKey))
            {
                return FallbackCannotBeMerged;
            }

            var target = await categories.FindAsync(userId, targetId, cancellationToken);
            if (target is null)
            {
                return NotFound;
            }

            if (target.IsArchived)
            {
                return MergeTargetError(CategoryRules.MergeTargetArchived);
            }

            if (target.Type != source.Type)
            {
                return MergeTargetError(CategoryRules.MergeTargetOtherType);
            }

            // Same-month limits are summed; the sum must still fit numeric(18,2).
            if (await categories.MergedBudgetExceedsAsync(userId, sourceId, targetId, Money.MaxAmount, cancellationToken))
            {
                return MergedBudgetTooLarge;
            }

            counts = await categories.ReassignAsync(userId, sourceId, targetId, cancellationToken);

            source.IsArchived = true;
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        LogMerged(userId, sourceId, targetId, counts.TransactionsMoved, counts.BudgetsMoved, counts.RulesMoved);

        var targetResponse = await categories.GetAsync(userId, targetId, cancellationToken);
        if (targetResponse is null)
        {
            return NotFound;
        }

        return new MergeCategoryResponse(
            counts.TransactionsMoved,
            counts.BudgetsMoved,
            counts.RulesMoved,
            targetResponse);
    }

    private static Error MergeTargetError(string message) =>
        Error.Validation(nameof(MergeCategoryRequest.TargetCategoryId), message);

    /// <summary>Position of a default category in the seeded list; custom categories sort after all defaults.</summary>
    private static int DefaultOrder(string? systemKey)
    {
        if (systemKey is null)
        {
            return int.MaxValue;
        }

        for (var i = 0; i < DefaultCategories.All.Count; i++)
        {
            if (DefaultCategories.All[i].SystemKey == systemKey)
            {
                return i;
            }
        }

        return int.MaxValue;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} created category {CategoryId}")]
    private partial void LogCreated(Guid userId, Guid categoryId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} archived category {CategoryId}")]
    private partial void LogArchived(Guid userId, Guid categoryId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} restored category {CategoryId}")]
    private partial void LogRestored(Guid userId, Guid categoryId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} deleted category {CategoryId}")]
    private partial void LogDeleted(Guid userId, Guid categoryId);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "User {UserId} merged category {SourceCategoryId} into {TargetCategoryId} "
            + "({TransactionsMoved} transactions, {BudgetsMoved} budgets, {RulesMoved} rules)")]
    private partial void LogMerged(
        Guid userId,
        Guid sourceCategoryId,
        Guid targetCategoryId,
        int transactionsMoved,
        int budgetsMoved,
        int rulesMoved);
}
