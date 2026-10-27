using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Common;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Budgets;

/// <summary>
/// Monthly category limits (FEATURES.md F6, PLAN.md §7 Budgets contracts): list a month with usage, set or remove
/// one limit, copy limits between months. Writes run under the user's category lock, the same one category merge
/// takes before summing budgets, so a limit can't be written into a category that is being merged away and two
/// writes of one month can't race. Changing or copying a limit never creates alerts.
/// </summary>
public sealed partial class BudgetService(
    IBudgetRepository budgets,
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    BudgetCalculator calculator,
    TimeProvider timeProvider,
    IValidator<SetBudgetCommand> validator,
    IValidator<BudgetMonthQuery> monthValidator,
    IValidator<CopyBudgetsQuery> copyValidator,
    ILogger<BudgetService> logger)
{
    public static readonly Error NothingToCopy = Error.Conflict("Nothing to copy", BudgetRules.NothingToCopy);

    /// <summary>The month's budgets with spent, remaining, usage and status, the unbudgeted spending and totals.</summary>
    public async Task<Result<BudgetMonthResponse>> ListAsync(
        Guid userId,
        string? month,
        CancellationToken cancellationToken)
    {
        var validation = await monthValidator.ValidateAsync(new BudgetMonthQuery(month), cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        CalendarMonth.TryParse(month, out var firstDay);
        return await calculator.CalculateMonthAsync(userId, firstDay, cancellationToken);
    }

    /// <summary>
    /// Copies the limits of <paramref name="from"/> into <paramref name="to"/> for active expense categories that
    /// have no limit in <paramref name="to"/> yet; existing limits are never overwritten. Conflict when nothing
    /// qualifies. Copying a limit never creates alerts.
    /// </summary>
    public async Task<Result<CopyBudgetsResponse>> CopyAsync(
        Guid userId,
        string? from,
        string? to,
        CancellationToken cancellationToken)
    {
        var validation = await copyValidator.ValidateAsync(new CopyBudgetsQuery(from, to), cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        CalendarMonth.TryParse(from, out var fromMonth);
        CalendarMonth.TryParse(to, out var toMonth);

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await TransactionLocks.AcquireCategoriesAsync(categories, userId, cancellationToken);

        var source = await budgets.ListCopyableAsync(userId, fromMonth, toMonth, cancellationToken);
        if (source.Count == 0)
        {
            return NothingToCopy;
        }

        var now = timeProvider.GetUtcNow();
        budgets.AddRange(source.Select(b => new Budget
        {
            Id = Guid.CreateVersion7(now),
            UserId = userId,
            CategoryId = b.CategoryId,
            Month = toMonth,
            LimitAmount = b.LimitAmount,
        }));

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        LogCopied(userId, source.Count, CalendarMonth.ToText(fromMonth), CalendarMonth.ToText(toMonth));
        return new CopyBudgetsResponse(source.Count);
    }

    /// <summary>
    /// Creates or replaces the limit of an expense category for a month (past, current or future). A limit of
    /// 0 or null removes the budget, also when there was none and also for a hidden category; setting a positive
    /// limit needs an active category.
    /// </summary>
    public async Task<Result<SetBudgetResult>> SetAsync(
        Guid userId,
        Guid categoryId,
        string? month,
        BudgetRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(new SetBudgetCommand(month, request.LimitAmount), cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        CalendarMonth.TryParse(month, out var firstDay);
        var limit = request.LimitAmount ?? 0m;

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await TransactionLocks.AcquireCategoriesAsync(categories, userId, cancellationToken);

        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return CategoryService.NotFound;
        }

        if (category.Type != CategoryType.Expense)
        {
            return CategoryError(BudgetRules.ExpenseCategoryOnly);
        }

        var budget = await budgets.FindAsync(userId, categoryId, firstDay, cancellationToken);

        if (limit == 0m)
        {
            if (budget is not null)
            {
                budgets.Remove(budget);
                await unitOfWork.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                LogRemoved(userId, categoryId, CalendarMonth.ToText(firstDay));
            }

            return new SetBudgetResult(null);
        }

        if (category.IsArchived)
        {
            return CategoryError(BudgetRules.CategoryArchived);
        }

        if (budget is null)
        {
            budgets.Add(new Budget
            {
                Id = Guid.CreateVersion7(timeProvider.GetUtcNow()),
                UserId = userId,
                CategoryId = categoryId,
                Month = firstDay,
                LimitAmount = limit,
            });
        }
        else
        {
            budget.LimitAmount = limit;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var monthText = CalendarMonth.ToText(firstDay);
        LogSet(userId, categoryId, monthText);
        return new SetBudgetResult(new BudgetResponse(categoryId, monthText, limit));
    }

    private static Error CategoryError(string message) => Error.Validation("categoryId", message);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} set the budget of category {CategoryId} for {Month}")]
    private partial void LogSet(Guid userId, Guid categoryId, string month);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} copied {Count} budgets from {From} to {To}")]
    private partial void LogCopied(Guid userId, int count, string from, string to);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} removed the budget of category {CategoryId} for {Month}")]
    private partial void LogRemoved(Guid userId, Guid categoryId, string month);
}
