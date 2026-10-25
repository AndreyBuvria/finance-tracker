using FinanceTracker.Application.Transactions;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/transfers")]
public sealed class TransfersController(TransferService transferService) : ApiControllerBase
{
    /// <summary>Moves money between two of the user's accounts (two rows sharing a transfer pair ID).</summary>
    [HttpPost]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status201Created)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> CreateAsync(
        TransferRequest request,
        CancellationToken cancellationToken)
    {
        var result = await transferService.CreateAsync(CurrentUserId, request, cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Changes both sides of a transfer.</summary>
    [HttpPut("{transferPairId:guid}")]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> UpdateAsync(
        Guid transferPairId,
        TransferRequest request,
        CancellationToken cancellationToken)
    {
        var result = await transferService.UpdateAsync(CurrentUserId, transferPairId, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Deletes both sides of a transfer.</summary>
    [HttpDelete("{transferPairId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteAsync(Guid transferPairId, CancellationToken cancellationToken)
    {
        var result = await transferService.DeleteAsync(CurrentUserId, transferPairId, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }
}
