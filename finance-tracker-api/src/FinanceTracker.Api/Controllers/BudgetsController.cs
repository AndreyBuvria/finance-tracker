using FinanceTracker.Application.Budgets;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/budgets")]
public sealed class BudgetsController(BudgetService budgetService) : ApiControllerBase
{
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
