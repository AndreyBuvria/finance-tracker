using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Transactions;

/// <summary>Body of <c>POST /transactions</c> and <c>PUT /transactions/{id}</c> (expenses and income only).</summary>
/// <param name="Type">Expense or Income. Transfers use <c>/transfers</c>.</param>
/// <param name="Amount">Greater than 0, at most 2 decimal places; the type decides the sign.</param>
/// <param name="Date">Calendar date, at most tomorrow (Europe/Warsaw); no lower limit.</param>
/// <param name="AccountId">An active account of the user (an unchanged archived account is kept on edit).</param>
/// <param name="CategoryId">
/// An active category of the matching type (an unchanged archived category is kept on edit).
/// </param>
/// <param name="Merchant">Optional, at most 200 characters (trimmed; blank means none).</param>
/// <param name="Note">Optional, at most 500 characters (trimmed; blank means none).</param>
public sealed record TransactionRequest(
    TransactionType? Type,
    decimal? Amount,
    DateOnly? Date,
    Guid? AccountId,
    Guid? CategoryId,
    string? Merchant,
    string? Note);

/// <summary>Query string of <c>GET /transactions</c>. Every filter is optional and they combine with AND.</summary>
public sealed record TransactionListQuery
{
    /// <summary>First date included.</summary>
    public DateOnly? From { get; init; }

    /// <summary>Last date included.</summary>
    public DateOnly? To { get; init; }

    /// <summary>Transactions of this account; a transfer matches when either of its sides is in it.</summary>
    public Guid? AccountId { get; init; }

    /// <summary>One or more categories (repeat the parameter: <c>categoryId=a&amp;categoryId=b</c>).</summary>
    public IReadOnlyList<Guid>? CategoryId { get; init; }

    /// <summary>Expense, Income or Transfer.</summary>
    public TransactionType? Type { get; init; }

    /// <summary>Smallest amount included (amounts are always positive).</summary>
    public decimal? MinAmount { get; init; }

    /// <summary>Largest amount included.</summary>
    public decimal? MaxAmount { get; init; }

    /// <summary>Text in the merchant or note, case- and accent-insensitive ("zabka" finds "Żabka").</summary>
    public string? Q { get; init; }

    /// <summary>1-based page number (default 1).</summary>
    public int Page { get; init; } = 1;

    /// <summary>Rows per page, 1–200 (default 50).</summary>
    public int PageSize { get; init; } = TransactionRules.DefaultPageSize;

    /// <summary>
    /// <c>date</c>, <c>amount</c>, <c>merchant</c>, <c>category</c> or <c>account</c>, prefixed with <c>-</c> for
    /// descending order (default <c>-date</c>). Ties are broken by ID in the same direction.
    /// </summary>
    public string? Sort { get; init; }
}

/// <summary>An account as shown on a transaction row.</summary>
public sealed record TransactionAccount(Guid Id, string Name, bool IsArchived);

/// <summary>A category as shown on a transaction row (chip with icon and color).</summary>
public sealed record TransactionCategory(
    Guid Id,
    string Name,
    CategoryType Type,
    string Icon,
    string Color,
    string? SystemKey,
    bool IsArchived);

/// <summary>Both sides of a transfer, shown as one row "From → To".</summary>
/// <param name="TransferPairId">ID used by <c>PUT/DELETE /transfers/{transferPairId}</c>.</param>
/// <param name="FromAccount">The account money left (the <c>Out</c> row).</param>
/// <param name="ToAccount">The account money arrived in (the <c>In</c> row).</param>
public sealed record TransferInfo(Guid TransferPairId, TransactionAccount FromAccount, TransactionAccount ToAccount);

/// <summary>The import batch an imported transaction came from (tooltip of the "Imported" badge).</summary>
public sealed record TransactionImportInfo(Guid BatchId, DateTimeOffset ImportedAt);

/// <summary>
/// One row of the transactions table. A transfer is one row (its <c>Out</c> side) with <see cref="Transfer"/> set,
/// no category and <see cref="Account"/> = the source account.
/// </summary>
/// <param name="Id">Transaction ID (for a transfer: the ID of its Out row).</param>
/// <param name="Type">Expense, Income or Transfer.</param>
/// <param name="Amount">Always positive; the type decides the sign.</param>
/// <param name="Date">Calendar date.</param>
/// <param name="Merchant">Merchant (the quick-add "Merchant / note" field), or null.</param>
/// <param name="Note">Note, or null.</param>
/// <param name="Source">Manual, Csv ("Imported" badge) or OpenBanking.</param>
/// <param name="Account">The account (archived ones carry <c>isArchived: true</c> for the badge).</param>
/// <param name="Category">The category, or null for a transfer.</param>
/// <param name="Transfer">Both accounts of a transfer, or null.</param>
/// <param name="Import">The import batch, or null for manual transactions.</param>
/// <param name="NeedsCategory">Imported into a fallback category ("Other" / "Other income"): highlight it.</param>
public sealed record TransactionResponse(
    Guid Id,
    TransactionType Type,
    decimal Amount,
    DateOnly Date,
    string? Merchant,
    string? Note,
    TransactionSource Source,
    TransactionAccount Account,
    TransactionCategory? Category,
    TransferInfo? Transfer,
    TransactionImportInfo? Import,
    bool NeedsCategory);

/// <summary>Footer totals over the whole filtered set (all pages). Transfers count as rows but add no money.</summary>
/// <param name="Income">Sum of income in income categories.</param>
/// <param name="Expenses">Expenses minus refunds (income in an expense category), never below 0 ("Spent").</param>
/// <param name="Net">Income − expenses, using the expenses as returned.</param>
public sealed record TransactionTotals(decimal Income, decimal Expenses, decimal Net)
{
    /// <summary>
    /// Builds the totals from the raw sums: expenses net of refunds are floored at 0 (a filter that matches only
    /// refunds shows no spending, not negative spending), and net follows the floored value.
    /// </summary>
    public static TransactionTotals FromSums(decimal income, decimal expensesMinusRefunds)
    {
        var expenses = Math.Max(expensesMinusRefunds, 0m);
        return new TransactionTotals(income, expenses, income - expenses);
    }
}

/// <summary>Result of <c>GET /transactions</c>.</summary>
/// <param name="Items">The requested page.</param>
/// <param name="Page">The requested page number.</param>
/// <param name="PageSize">The requested page size.</param>
/// <param name="TotalCount">Rows matching the filters (a transfer counts once).</param>
/// <param name="TotalPages">Pages available for this page size (0 when nothing matches).</param>
/// <param name="Totals">Footer totals over all matching rows.</param>
public sealed record TransactionPageResponse(
    IReadOnlyList<TransactionResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    TransactionTotals Totals);

/// <summary>Body of <c>POST /transactions/bulk</c>.</summary>
/// <param name="Action">Delete or Recategorize.</param>
/// <param name="TransactionIds">1–500 transaction IDs (a transfer row deletes its whole pair).</param>
/// <param name="CategoryId">Required for Recategorize: an active category matching every selected transaction.</param>
public sealed record BulkTransactionRequest(
    BulkTransactionAction? Action,
    IReadOnlyList<Guid>? TransactionIds,
    Guid? CategoryId);

public enum BulkTransactionAction
{
    Delete,
    Recategorize,
}

/// <summary>Result of <c>POST /transactions/bulk</c>.</summary>
/// <param name="AffectedCount">Table rows deleted or recategorized (a transfer pair counts once).</param>
public sealed record BulkTransactionResponse(int AffectedCount);

/// <summary>Query string of <c>GET /transactions/merchants</c>.</summary>
public sealed record MerchantQuery
{
    /// <summary>Part of the merchant name, case- and accent-insensitive; empty lists the most recent merchants.</summary>
    public string? Q { get; init; }

    /// <summary>How many suggestions to return, 1–20 (default 10).</summary>
    public int? Limit { get; init; }
}

/// <summary>A past merchant for autocomplete.</summary>
/// <param name="Merchant">The merchant exactly as saved.</param>
/// <param name="LastUsedOn">Date of the merchant's most recent transaction.</param>
/// <param name="LastCategory">
/// Category of the merchant's most recent transaction whose category is still active (to preselect when its type
/// matches the form); null when none.
/// </param>
public sealed record MerchantSuggestion(string Merchant, DateOnly LastUsedOn, TransactionCategory? LastCategory);

/// <summary>Result of <c>GET /transactions/merchants</c>.</summary>
public sealed record MerchantListResponse(IReadOnlyList<MerchantSuggestion> Items);

/// <summary>Body of <c>POST /transfers</c> and <c>PUT /transfers/{transferPairId}</c>.</summary>
/// <param name="FromAccountId">Account the money leaves.</param>
/// <param name="ToAccountId">Account the money arrives in; must differ from <paramref name="FromAccountId"/>.</param>
/// <param name="Amount">Greater than 0, at most 2 decimal places.</param>
/// <param name="Date">Calendar date, at most tomorrow (Europe/Warsaw).</param>
/// <param name="Note">Optional, at most 500 characters.</param>
public sealed record TransferRequest(
    Guid? FromAccountId,
    Guid? ToAccountId,
    decimal? Amount,
    DateOnly? Date,
    string? Note);

/// <summary>Validated, normalized filters handed to the repository.</summary>
public sealed record TransactionFilter(
    DateOnly? From,
    DateOnly? To,
    Guid? AccountId,
    IReadOnlyList<Guid> CategoryIds,
    TransactionType? Type,
    decimal? MinAmount,
    decimal? MaxAmount,
    string? Search);

/// <summary>Allow-listed sort columns of the transactions table.</summary>
public enum TransactionSortField
{
    Date,
    Amount,
    Merchant,
    Category,
    Account,
}

public sealed record TransactionSort(TransactionSortField Field, bool Descending);

/// <summary>One page of rows plus the count and totals of the whole filtered set.</summary>
public sealed record TransactionPage(
    IReadOnlyList<TransactionResponse> Items,
    int TotalCount,
    TransactionTotals Totals);

/// <summary>What a bulk action needs to know about a selected transaction.</summary>
public sealed record TransactionHeader(Guid Id, TransactionType Type, Guid? TransferPairId);
