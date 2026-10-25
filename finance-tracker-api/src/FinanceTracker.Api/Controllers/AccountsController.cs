using FinanceTracker.Application.Accounts;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/accounts")]
public sealed class AccountsController(AccountService accountService) : ApiControllerBase
{
    /// <summary>The user's accounts with computed balances and net worth; archived ones only on request.</summary>
    [HttpGet]
    [ProducesResponseType<AccountListResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AccountListResponse>> ListAsync(
        [FromQuery] bool includeArchived,
        CancellationToken cancellationToken) =>
        Ok(await accountService.ListAsync(CurrentUserId, includeArchived, cancellationToken));

    [HttpPost]
    [ProducesResponseType<AccountResponse>(StatusCodes.Status201Created)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AccountResponse>> CreateAsync(
        AccountRequest request,
        CancellationToken cancellationToken)
    {
        var result = await accountService.CreateAsync(CurrentUserId, request, cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : ErrorResult(result.Error);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<AccountResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AccountResponse>> UpdateAsync(
        Guid id,
        AccountRequest request,
        CancellationToken cancellationToken)
    {
        var result = await accountService.UpdateAsync(CurrentUserId, id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Archives the account (never hard-deletes it).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> ArchiveAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await accountService.ArchiveAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    [HttpPost("{id:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> RestoreAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await accountService.RestoreAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }
}
