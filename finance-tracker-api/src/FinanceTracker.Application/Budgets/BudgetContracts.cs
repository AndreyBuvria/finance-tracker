using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Budgets;

/// <summary>Body of <c>PUT /budgets/{categoryId}?month=YYYY-MM</c>.</summary>
/// <param name="LimitAmount">
/// The monthly limit: positive, at most 2 decimal places. <c>0</c> or <c>null</c> removes the budget.
/// </param>
public sealed record BudgetRequest(decimal? LimitAmount);

/// <summary>A monthly spending limit for one expense category.</summary>
/// <param name="CategoryId">The expense category.</param>
/// <param name="Month">The budgeted calendar month as <c>YYYY-MM</c>.</param>
/// <param name="LimitAmount">The limit (positive).</param>
public sealed record BudgetResponse(Guid CategoryId, string Month, decimal LimitAmount);

/// <summary>Everything <c>PUT /budgets/{categoryId}</c> validates before touching the database.</summary>
/// <param name="Month">The <c>month</c> query value as sent.</param>
/// <param name="LimitAmount">The limit from the body.</param>
public sealed record SetBudgetCommand(string? Month, decimal? LimitAmount);

/// <summary>Outcome of setting a limit: the saved budget, or null when the limit was removed.</summary>
public sealed record SetBudgetResult(BudgetResponse? Budget);

/// <summary>Query of <c>GET /budgets?month=YYYY-MM</c>, validated before touching the database.</summary>
/// <param name="Month">The <c>month</c> query value as sent.</param>
public sealed record BudgetMonthQuery(string? Month);

/// <summary>Query of <c>POST /budgets/copy?from=YYYY-MM&amp;to=YYYY-MM</c>, validated before touching the database.</summary>
/// <param name="From">The month to copy limits from, as sent.</param>
/// <param name="To">The month to copy limits into, as sent.</param>
public sealed record CopyBudgetsQuery(string? From, string? To);

/// <summary>Result of <c>POST /budgets/copy</c>.</summary>
/// <param name="Copied">How many limits were created in the target month.</param>
public sealed record CopyBudgetsResponse(int Copied);

/// <summary>The category of a budget row.</summary>
public sealed record BudgetCategoryResponse(Guid Id, string Name, string Icon, string Color);

/// <summary>One budgeted category of a month (an active expense category with a limit).</summary>
/// <param name="Category">The category.</param>
/// <param name="LimitAmount">The month's limit (positive).</param>
/// <param name="Spent">Expenses − refunds in the month, never below 0. Transfers are excluded.</param>
/// <param name="Remaining">Limit − Spent; negative when over budget.</param>
/// <param name="Usage">Spent ÷ Limit, truncated to 4 decimal places (1 = 100%).</param>
/// <param name="Status">Ok below 80%, Warning from 80% to below 100%, Over at 100% or more.</param>
public sealed record BudgetItemResponse(
    BudgetCategoryResponse Category,
    decimal LimitAmount,
    decimal Spent,
    decimal Remaining,
    decimal Usage,
    BudgetStatus Status);

/// <summary>The category of an unbudgeted row; hidden categories appear only when they had spending.</summary>
public sealed record UnbudgetedCategoryResponse(Guid Id, string Name, string Icon, string Color, bool IsArchived);

/// <summary>Spending of one category without a usable budget in the month.</summary>
public sealed record UnbudgetedItemResponse(UnbudgetedCategoryResponse Category, decimal Spent);

/// <summary>"Spending without a budget": its total and the categories in it, by spent (highest first), then name.</summary>
public sealed record UnbudgetedResponse(decimal Total, IReadOnlyList<UnbudgetedItemResponse> Items);

/// <summary>Totals over the budgeted items of a month.</summary>
/// <param name="Limit">Sum of limits.</param>
/// <param name="Spent">Sum of the items' Spent (each already floored at 0).</param>
/// <param name="Remaining">Limit − Spent; over-budget categories count as negative, so this may be negative.</param>
/// <param name="Usage">Spent ÷ Limit, truncated to 4 decimal places.</param>
/// <param name="Status">Overall status from total Spent ÷ total Limit.</param>
/// <param name="DailyAllowance">
/// Current month only: max(Remaining, 0) ÷ days left (today included), rounded down to 2 decimal places; otherwise
/// null.
/// </param>
public sealed record BudgetTotalsResponse(
    decimal Limit,
    decimal Spent,
    decimal Remaining,
    decimal Usage,
    BudgetStatus Status,
    decimal? DailyAllowance);

/// <summary>Budgets of one month with their usage (<c>GET /budgets?month=YYYY-MM</c>).</summary>
/// <param name="Month">The month as <c>YYYY-MM</c>.</param>
/// <param name="Period">Past, Current or Future relative to today in Europe/Warsaw.</param>
/// <param name="DaysLeft">Current month only: days left including today; otherwise null.</param>
/// <param name="Items">Active expense categories with a limit, by name.</param>
/// <param name="Unbudgeted">Active expense categories without a limit plus hidden ones with spending.</param>
/// <param name="Totals">Totals over <paramref name="Items"/>, or null when there are none.</param>
/// <param name="CanCopyFromPreviousMonth">
/// Whether copying from the previous month would create at least one limit (same rules as the copy: only categories
/// without a limit this month, hidden ones skipped).
/// </param>
public sealed record BudgetMonthResponse(
    string Month,
    MonthPeriod Period,
    int? DaysLeft,
    IReadOnlyList<BudgetItemResponse> Items,
    UnbudgetedResponse Unbudgeted,
    BudgetTotalsResponse? Totals,
    bool CanCopyFromPreviousMonth);

/// <summary>An expense category of the user with its limit in one month (null when it has none).</summary>
public sealed record BudgetCategoryRow(
    Guid Id,
    string Name,
    string Icon,
    string Color,
    bool IsArchived,
    decimal? LimitAmount);
