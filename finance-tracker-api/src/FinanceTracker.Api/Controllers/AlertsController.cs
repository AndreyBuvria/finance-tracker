using FinanceTracker.Application.Alerts;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/alerts")]
public sealed class AlertsController(AlertService alertService) : ApiControllerBase
{
    /// <summary>The user's budget alerts, newest first, with the number of unread ones (for the bell).</summary>
    [HttpGet]
    [ProducesResponseType<AlertListResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AlertListResponse>> ListAsync(
        [FromQuery] AlertListQuery query,
        CancellationToken cancellationToken)
    {
        var result = await alertService.ListAsync(CurrentUserId, query, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Marks one alert read; repeating it keeps the first read time.</summary>
    /// <param name="id">The user's alert.</param>
    /// <param name="cancellationToken">Aborts the request.</param>
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> MarkReadAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await alertService.MarkReadAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    /// <summary>Marks every unread alert of the user read.</summary>
    [HttpPost("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> MarkAllReadAsync(CancellationToken cancellationToken)
    {
        await alertService.MarkAllReadAsync(CurrentUserId, cancellationToken);
        return NoContent();
    }
}
