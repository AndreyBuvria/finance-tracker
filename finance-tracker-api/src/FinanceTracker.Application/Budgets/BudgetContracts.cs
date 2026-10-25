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
