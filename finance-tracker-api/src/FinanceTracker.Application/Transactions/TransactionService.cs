using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Transactions;

/// <summary>
/// Manual expenses and income (FEATURES.md F3, PLAN.md §6 Transactions): list with filters/paging/sorting/totals,
/// create, edit, delete (with import tombstones), bulk delete/recategorize and merchant autocomplete.
/// Writes that pick an account or category run under the same per-user locks as category archive/merge/delete and
/// account archive, so a transaction can't land in a category or account that is being archived or merged away.
/// </summary>
public sealed partial class TransactionService(
    ITransactionRepository transactions,
    IAccountRepository accounts,
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    IValidator<TransactionRequest> validator,
    IValidator<TransactionListQuery> listQueryValidator,
    IValidator<MerchantQuery> merchantQueryValidator,
    IValidator<BulkTransactionRequest> bulkValidator,
    ILogger<TransactionService> logger)
{
    /// <summary>Missing or another user's transaction; both look the same to the caller.</summary>
    public static readonly Error NotFound = Error.NotFound("Transaction not found", "This transaction doesn't exist.");

    public static readonly Error SomeNotFound = Error.NotFound(
        "Transactions not found",
        "One or more of the selected transactions don't exist. Refresh the list and try again.");

    public static readonly Error IsTransfer = Error.Conflict(
        "Transaction is a transfer",
        "This transaction is part of a transfer. Edit or delete the transfer instead.");

    public async Task<Result<TransactionPageResponse>> ListAsync(
        Guid userId,
        TransactionListQuery query,
        CancellationToken cancellationToken)
    {
        var validation = await listQueryValidator.ValidateAsync(query, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        TransactionRules.TryParseSort(query.Sort, out var sort);
        var filter = new TransactionFilter(
            query.From,
            query.To,
            query.AccountId,
            query.CategoryId?.Distinct().ToList() ?? [],
            query.Type,
            query.MinAmount,
            query.MaxAmount,
            TransactionRules.NormalizeText(query.Q));

        var offset = (long)(query.Page - 1) * query.PageSize;
        var page = await transactions.ListAsync(userId, filter, sort, offset, query.PageSize, cancellationToken);
        var totalPages = (int)((page.TotalCount + (long)query.PageSize - 1) / query.PageSize);

        return new TransactionPageResponse(
            page.Items,
            query.Page,
            query.PageSize,
            page.TotalCount,
            totalPages,
            page.Totals);
    }

    /// <summary>Past merchants for the quick-add autocomplete, each with its last-used active category.</summary>
    public async Task<Result<MerchantListResponse>> ListMerchantsAsync(
        Guid userId,
        MerchantQuery query,
        CancellationToken cancellationToken)
    {
        var validation = await merchantQueryValidator.ValidateAsync(query, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var items = await transactions.ListMerchantsAsync(
            userId,
            TransactionRules.NormalizeText(query.Q),
            query.Limit ?? TransactionRules.MerchantDefaultLimit,
            cancellationToken);

        return new MerchantListResponse(items);
    }

    public async Task<Result<TransactionResponse>> CreateAsync(
        Guid userId,
        TransactionRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var transaction = new Transaction
        {
            Id = Guid.CreateVersion7(timeProvider.GetUtcNow()),
            UserId = userId,
            Source = TransactionSource.Manual,
        };

        await using (var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await LockAsync(userId, cancellationToken);

            var error = await CheckAccountAndCategoryAsync(userId, request, current: null, cancellationToken);
            if (error is not null)
            {
                return error;
            }

            Apply(transaction, request);
            transactions.Add(transaction);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
        }

        LogCreated(userId, transaction.Id);
        return await GetAsync(userId, transaction.Id, cancellationToken);
    }

    /// <summary>
    /// Replaces an expense or income (all fields). The account or category may stay archived if unchanged; a new
    /// one must be active. Imported transactions keep their source and hash, so re-import won't duplicate them.
    /// </summary>
    public async Task<Result<TransactionResponse>> UpdateAsync(
        Guid userId,
        Guid transactionId,
        TransactionRequest request,
        CancellationToken cancellationToken)
    {
        await using (var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await LockAsync(userId, cancellationToken);

            var transaction = await transactions.FindAsync(userId, transactionId, cancellationToken);
            if (transaction is null)
            {
                return NotFound;
            }

            if (transaction.Type == TransactionType.Transfer)
            {
                return IsTransfer;
            }

            var validation = await validator.ValidateAsync(request, cancellationToken);
            if (!validation.IsValid)
            {
                return validation.ToError();
            }

            var error = await CheckAccountAndCategoryAsync(userId, request, transaction, cancellationToken);
            if (error is not null)
            {
                return error;
            }

            Apply(transaction, request);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            await dbTransaction.CommitAsync(cancellationToken);
        }

        LogUpdated(userId, transactionId);
        return await GetAsync(userId, transactionId, cancellationToken);
    }

    /// <summary>
    /// Deletes a transaction; a transfer row deletes its whole pair. Imported rows leave a tombstone so re-import
    /// skips them.
    /// </summary>
    public async Task<Result> DeleteAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken)
    {
        await using var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await LockAsync(userId, cancellationToken);

        var transaction = await transactions.FindAsync(userId, transactionId, cancellationToken);
        if (transaction is null)
        {
            return NotFound;
        }

        if (transaction.TransferPairId is { } pairId)
        {
            await transactions.DeleteAsync(userId, [], [pairId], cancellationToken);
        }
        else
        {
            await transactions.DeleteAsync(userId, [transactionId], [], cancellationToken);
        }
        await dbTransaction.CommitAsync(cancellationToken);

        LogDeleted(userId, 1);
        return Result.Success();
    }

    /// <summary>
    /// Deletes or recategorizes the selected transactions in one database transaction: either every selected row
    /// is changed or none is. A selected transfer is deleted as a whole pair and can't be recategorized.
    /// </summary>
    public async Task<Result<BulkTransactionResponse>> BulkAsync(
        Guid userId,
        BulkTransactionRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await bulkValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var ids = request.TransactionIds!.Distinct().ToList();
        int affected;

        await using (var dbTransaction = await unitOfWork.BeginTransactionAsync(cancellationToken))
        {
            await LockAsync(userId, cancellationToken);

            var headers = await transactions.ListHeadersAsync(userId, ids, cancellationToken);
            if (headers.Count != ids.Count)
            {
                return SomeNotFound;
            }

            var result = request.Action == BulkTransactionAction.Delete
                ? await BulkDeleteAsync(userId, headers, cancellationToken)
                : await BulkRecategorizeAsync(userId, headers, request.CategoryId!.Value, cancellationToken);
            if (!result.IsSuccess)
            {
                return result.Error;
            }

            affected = result.Value;
            await dbTransaction.CommitAsync(cancellationToken);
        }

        LogBulk(userId, request.Action!.Value, affected);
        return new BulkTransactionResponse(affected);
    }

    private async Task<Result<int>> BulkDeleteAsync(
        Guid userId,
        IReadOnlyList<TransactionHeader> headers,
        CancellationToken cancellationToken)
    {
        var plainIds = headers.Where(h => h.TransferPairId is null).Select(h => h.Id).ToList();
        var pairIds = headers
            .Where(h => h.TransferPairId is not null)
            .Select(h => h.TransferPairId!.Value)
            .Distinct()
            .ToList();

        await transactions.DeleteAsync(userId, plainIds, pairIds, cancellationToken);

        // One table row per expense/income and per transfer pair, as the user selected them.
        return plainIds.Count + pairIds.Count;
    }

    private async Task<Result<int>> BulkRecategorizeAsync(
        Guid userId,
        IReadOnlyList<TransactionHeader> headers,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        if (headers.Any(h => h.Type == TransactionType.Transfer))
        {
            return Error.Validation(
                nameof(BulkTransactionRequest.TransactionIds),
                TransactionRules.BulkTransfersHaveNoCategory);
        }

        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return CategoryService.NotFound;
        }

        if (category.IsArchived)
        {
            return Error.Validation(nameof(BulkTransactionRequest.CategoryId), TransactionRules.CategoryArchived);
        }

        // Expenses need an expense category; income fits either type (in an expense category it is a refund).
        // So only an income category with expenses selected is refused: with nothing but expenses selected the
        // category is wrong, with a mix the selection is.
        if (headers.Any(h => !TransactionRules.CategoryFits(h.Type, category.Type)))
        {
            return headers.All(h => h.Type == TransactionType.Expense)
                ? Error.Validation(nameof(BulkTransactionRequest.CategoryId), TransactionRules.ExpenseCategoryRequired)
                : Error.Validation(nameof(BulkTransactionRequest.TransactionIds), TransactionRules.BulkMixedTypes);
        }

        return await transactions.RecategorizeAsync(
            userId,
            [.. headers.Select(h => h.Id)],
            categoryId,
            cancellationToken);
    }

    /// <summary>
    /// Every transaction write takes the same per-user locks in the same order (categories, then accounts; see
    /// <see cref="TransactionLocks"/>), so writes can't deadlock with each other or with category merge/archive,
    /// account archive or transfer changes.
    /// </summary>
    private Task LockAsync(Guid userId, CancellationToken cancellationToken) =>
        TransactionLocks.AcquireAsync(categories, accounts, userId, cancellationToken);

    /// <summary>
    /// The account and category must be the user's (else 404). A newly chosen one must be active; one the
    /// transaction already uses may stay archived. The category type must always match the transaction type.
    /// </summary>
    private async Task<Error?> CheckAccountAndCategoryAsync(
        Guid userId,
        TransactionRequest request,
        Transaction? current,
        CancellationToken cancellationToken)
    {
        var accountId = request.AccountId!.Value;
        var account = await accounts.FindAsync(userId, accountId, cancellationToken);
        if (account is null)
        {
            return AccountService.NotFound;
        }

        if (account.IsArchived && current?.AccountId != accountId)
        {
            return Error.Validation(nameof(TransactionRequest.AccountId), TransactionRules.AccountArchived);
        }

        var categoryId = request.CategoryId!.Value;
        var category = await categories.FindAsync(userId, categoryId, cancellationToken);
        if (category is null)
        {
            return CategoryService.NotFound;
        }

        if (!TransactionRules.CategoryFits(request.Type!.Value, category.Type))
        {
            return Error.Validation(nameof(TransactionRequest.CategoryId), TransactionRules.ExpenseCategoryRequired);
        }

        if (category.IsArchived && current?.CategoryId != categoryId)
        {
            return Error.Validation(nameof(TransactionRequest.CategoryId), TransactionRules.CategoryArchived);
        }

        return null;
    }

    private static void Apply(Transaction transaction, TransactionRequest request)
    {
        transaction.Type = request.Type!.Value;
        transaction.Amount = request.Amount!.Value;
        transaction.Date = request.Date!.Value;
        transaction.AccountId = request.AccountId!.Value;
        transaction.CategoryId = request.CategoryId!.Value;
        transaction.Merchant = TransactionRules.NormalizeText(request.Merchant);
        transaction.Note = TransactionRules.NormalizeText(request.Note);
    }

    private async Task<Result<TransactionResponse>> GetAsync(
        Guid userId,
        Guid transactionId,
        CancellationToken cancellationToken)
    {
        var response = await transactions.GetAsync(userId, transactionId, cancellationToken);
        return response is null ? NotFound : response;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} created transaction {TransactionId}")]
    private partial void LogCreated(Guid userId, Guid transactionId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} updated transaction {TransactionId}")]
    private partial void LogUpdated(Guid userId, Guid transactionId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} deleted {Count} transaction(s)")]
    private partial void LogDeleted(Guid userId, int count);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "User {UserId} ran bulk {Action} on {AffectedCount} transaction(s)")]
    private partial void LogBulk(Guid userId, BulkTransactionAction action, int affectedCount);
}
