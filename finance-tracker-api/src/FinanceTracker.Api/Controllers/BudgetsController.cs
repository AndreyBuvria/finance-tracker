using FinanceTracker.Application.Budgets;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/budgets")]
public sealed class BudgetsController(BudgetService budgetService) : ApiControllerBase
{
    /// <summary>
    /// The month's budgets: each active expense category with a limit (spent, remaining, usage, status), the
    /// spending without a budget, and totals with the daily allowance (current month only).
    /// </summary>
    /// <param name="month">The month as <c>YYYY-MM</c>; past, current and future months are allowed.</param>
    /// <param name="cancellationToken">Aborts the request.</param>
    [HttpGet]
    [ProducesResponseType<BudgetMonthResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BudgetMonthResponse>> ListAsync(
        [FromQuery] string? month,
        CancellationToken cancellationToken)
    {
        var result = await budgetService.ListAsync(CurrentUserId, month, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>
    /// Copies the limits of one month into another for active expense categories that have no limit there yet.
    /// 409 when nothing qualifies.
    /// </summary>
    /// <param name="from">The month to copy from, as <c>YYYY-MM</c>.</param>
    /// <param name="to">The month to copy into, as <c>YYYY-MM</c>; must differ from <paramref name="from"/>.</param>
    /// <param name="cancellationToken">Aborts the request.</param>
    [HttpPost("copy")]
    [ProducesResponseType<CopyBudgetsResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CopyBudgetsResponse>> CopyAsync(
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken cancellationToken)
    {
        var result = await budgetService.CopyAsync(CurrentUserId, from, to, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>
    /// Sets the monthly limit of an expense category (creates or replaces it). A <c>limitAmount</c> of 0 or null
    /// removes the budget and returns 204, also when there was none.
    /// </summary>
    /// <param name="categoryId">The user's expense category; it must be active to set a limit.</param>
    /// <param name="month">The month as <c>YYYY-MM</c>; past, current and future months are allowed.</param>
    /// <param name="request">The new limit.</param>
    /// <param name="cancellationToken">Aborts the request.</param>
    [HttpPut("{categoryId:guid}")]
    [ProducesResponseType<BudgetResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetResponse>> SetAsync(
        Guid categoryId,
        [FromQuery] string? month,
        BudgetRequest request,
        CancellationToken cancellationToken)
    {
        var result = await budgetService.SetAsync(CurrentUserId, categoryId, month, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return ErrorResult(result.Error);
        }

        return result.Value.Budget is { } budget ? Ok(budget) : NoContent();
    }
}
