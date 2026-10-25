using FinanceTracker.Application.Transactions;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/transactions")]
public sealed class TransactionsController(TransactionService transactionService) : ApiControllerBase
{
    /// <summary>
    /// One page of the transactions table with filters and sorting, plus count and footer totals over all matching
    /// rows. A transfer is one row.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<TransactionPageResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TransactionPageResponse>> ListAsync(
        [FromQuery] TransactionListQuery query,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.ListAsync(CurrentUserId, query, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Past merchants for autocomplete, each with its last-used active category.</summary>
    [HttpGet("merchants")]
    [ProducesResponseType<MerchantListResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MerchantListResponse>> ListMerchantsAsync(
        [FromQuery] MerchantQuery query,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.ListMerchantsAsync(CurrentUserId, query, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Adds an expense or income (transfers use <c>/api/transfers</c>).</summary>
    [HttpPost]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status201Created)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> CreateAsync(
        TransactionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.CreateAsync(CurrentUserId, request, cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : ErrorResult(result.Error);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TransactionResponse>> UpdateAsync(
        Guid id,
        TransactionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.UpdateAsync(CurrentUserId, id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>
    /// Deletes a transaction; for a transfer row (either side) it deletes the whole transfer pair. An imported row
    /// won't come back on re-import.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await transactionService.DeleteAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    /// <summary>Deletes or recategorizes the selected transactions, all or nothing.</summary>
    [HttpPost("bulk")]
    [ProducesResponseType<BulkTransactionResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BulkTransactionResponse>> BulkAsync(
        BulkTransactionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.BulkAsync(CurrentUserId, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }
}
