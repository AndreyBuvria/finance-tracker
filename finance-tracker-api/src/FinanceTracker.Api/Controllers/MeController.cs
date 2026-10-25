using FinanceTracker.Application.Me;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/me")]
public sealed class MeController(MeService meService) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponse>> GetAsync(CancellationToken cancellationToken)
    {
        var result = await meService.GetAsync(CurrentUserId, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    [HttpPost("onboarding/complete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> CompleteOnboardingAsync(CancellationToken cancellationToken)
    {
        var result = await meService.CompleteOnboardingAsync(CurrentUserId, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }
}
