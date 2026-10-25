using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Transactions;

/// <summary>
/// Transfers between the user's own accounts (FEATURES.md F4, PLAN.md §6 Transfers): two rows sharing a
/// <c>TransferPairId</c> — <c>Out</c> on the source account, <c>In</c> on the destination — always created, changed
/// and deleted together in one database transaction. They move balances but never count as income or spending.
/// </summary>
public sealed partial class TransferService(
    ITransactionRepository transactions,
    IAccountRepository accounts,
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    IValidator<TransferRequest> validator,
    ILogger<TransferService> logger)
{
    /// <summary>Missing or another user's transfer; both look the same to the caller.</summary>
    public static readonly Error NotFound = Error.NotFound("Transfer not found", "This transfer doesn't exist.");

    public async Task<Result<TransactionResponse>> CreateAsync(
        Guid userId,
        TransferRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var now = timeProvider.GetUtcNow();
        var pairId = Guid.CreateVersion7(now);
        var outRow = NewRow(userId, pairId, TransferDirection.Out, now);
        var inRow = NewRow(userId, pairId, TransferDirection.In, now);

        await using (var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await accounts.LockUserAccountsAsync(userId, cancellationToken);

            var error = await CheckAccountsAsync(userId, request, current: null, cancellationToken);
            if (error is not null)
            {
                return error;
            }

            Apply(outRow, inRow, request);
            transactions.Add(outRow, inRow);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
        }

        LogCreated(userId, pairId);
        return await GetAsync(userId, pairId, cancellationToken);
    }

    /// <summary>
    /// Replaces both sides of a transfer (accounts, amount, date, note). An unchanged archived account may stay;
    /// a newly chosen one must be active.
    /// </summary>
    public async Task<Result<TransactionResponse>> UpdateAsync(
        Guid userId,
        Guid transferPairId,
        TransferRequest request,
        CancellationToken cancellationToken)
    {
        await using (var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await accounts.LockUserAccountsAsync(userId, cancellationToken);

            var rows = await transactions.FindTransferAsync(userId, transferPairId, cancellationToken);
            var outRow = rows.SingleOrDefault(r => r.TransferDirection == TransferDirection.Out);
            var inRow = rows.SingleOrDefault(r => r.TransferDirection == TransferDirection.In);
            if (outRow is null || inRow is null)
            {
                return NotFound;
            }

            var validation = await validator.ValidateAsync(request, cancellationToken);
            if (!validation.IsValid)
            {
                return validation.ToError();
            }

            var error = await CheckAccountsAsync(userId, request, (outRow.AccountId, inRow.AccountId), cancellationToken);
            if (error is not null)
            {
                return error;
            }

            Apply(outRow, inRow, request);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
        }

        LogUpdated(userId, transferPairId);
        return await GetAsync(userId, transferPairId, cancellationToken);
    }

    /// <summary>Deletes both sides of a transfer (imported sides leave tombstones).</summary>
    public async Task<Result> DeleteAsync(Guid userId, Guid transferPairId, CancellationToken cancellationToken)
    {
        await using var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await TransactionLocks.AcquireAsync(categories, accounts, userId, cancellationToken);

        var deleted = await transactions.DeleteAsync(userId, [], [transferPairId], cancellationToken);
        if (deleted == 0)
        {
            return NotFound;
        }

        await dbTransaction.CommitAsync(cancellationToken);

        LogDeleted(userId, transferPairId);
        return Result.Success();
    }

    /// <summary>
    /// Both accounts must be the user's (else 404); a newly chosen account must be active, while the account a side
    /// already uses may stay archived.
    /// </summary>
    private async Task<Error?> CheckAccountsAsync(
        Guid userId,
        TransferRequest request,
        (Guid From, Guid To)? current,
        CancellationToken cancellationToken)
    {
        var from = await accounts.FindAsync(userId, request.FromAccountId!.Value, cancellationToken);
        var to = await accounts.FindAsync(userId, request.ToAccountId!.Value, cancellationToken);
        if (from is null || to is null)
        {
            return AccountService.NotFound;
        }

        var errors = new Dictionary<string, string[]>();
        if (from.IsArchived && current?.From != from.Id && current?.To != from.Id)
        {
            errors[nameof(TransferRequest.FromAccountId)] = [TransactionRules.AccountArchived];
        }

        if (to.IsArchived && current?.From != to.Id && current?.To != to.Id)
        {
            errors[nameof(TransferRequest.ToAccountId)] = [TransactionRules.AccountArchived];
        }

        return errors.Count == 0 ? null : Error.Validation(errors);
    }

    private static Transaction NewRow(Guid userId, Guid pairId, TransferDirection direction, DateTimeOffset now) =>
        new()
        {
            Id = Guid.CreateVersion7(now),
            UserId = userId,
            Type = TransactionType.Transfer,
            TransferDirection = direction,
            TransferPairId = pairId,
            Source = TransactionSource.Manual,
        };

    private static void Apply(Transaction outRow, Transaction inRow, TransferRequest request)
    {
        var note = TransactionRules.NormalizeText(request.Note);
        outRow.AccountId = request.FromAccountId!.Value;
        inRow.AccountId = request.ToAccountId!.Value;
        foreach (var row in (Transaction[])[outRow, inRow])
        {
            row.Amount = request.Amount!.Value;
            row.Date = request.Date!.Value;
            row.Note = note;
        }
    }

    private async Task<Result<TransactionResponse>> GetAsync(
        Guid userId,
        Guid transferPairId,
        CancellationToken cancellationToken)
    {
        var response = await transactions.GetTransferAsync(userId, transferPairId, cancellationToken);
        return response is null ? NotFound : response;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} created transfer {TransferPairId}")]
    private partial void LogCreated(Guid userId, Guid transferPairId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} updated transfer {TransferPairId}")]
    private partial void LogUpdated(Guid userId, Guid transferPairId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} deleted transfer {TransferPairId}")]
    private partial void LogDeleted(Guid userId, Guid transferPairId);
}
