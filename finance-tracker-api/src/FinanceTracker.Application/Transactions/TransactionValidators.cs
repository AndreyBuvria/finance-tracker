using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FluentValidation;

namespace FinanceTracker.Application.Transactions;

/// <summary>User-facing messages and limits for transactions and transfers (FEATURES.md F3, F4).</summary>
public static class TransactionRules
{
    public const string TypeRequired = "Choose a transaction type.";
    public const string TypeNotTransfer = "Choose Expense or Income. Record transfers as a transfer.";
    public const string AmountRequired = "Enter an amount greater than 0.";
    public const string AmountTooManyDecimals = "Enter an amount with at most 2 decimal places.";
    public const string AmountTooLarge = "Enter a smaller amount.";
    public const string DateRequired = "Choose a date.";
    public const string DateInFuture = "Date can't be in the future.";
    public const string AccountRequired = "Choose an account.";
    public const string AccountArchived = "This account is archived. Choose an active account.";
    public const string CategoryRequired = "Choose a category.";
    public const string CategoryArchived = "This category is hidden. Choose an active category.";
    public const string ExpenseCategoryRequired = "Choose an expense category.";
    public const string MerchantTooLong = "Merchant can be at most 200 characters.";
    public const string NoteTooLong = "Note can be at most 500 characters.";

    public const string FromAccountRequired = "Choose the account to move money from.";
    public const string ToAccountRequired = "Choose the account to move money to.";
    public const string SameAccounts = "Choose two different accounts.";

    public const string DateRangeReversed = "End date can't be before start date.";
    public const string FilterAmountNegative = "Enter an amount of 0 or more.";
    public const string AmountRangeReversed = "Maximum amount can't be less than minimum amount.";
    public const string SearchTooLong = "Search can be at most 100 characters.";
    public const string PageOutOfRange = "Page must be 1 or more.";
    public const string PageSizeOutOfRange = "Page size must be between 1 and 200.";
    public const string SortUnknown = "Sort by date, amount, merchant, category or account.";
    public const string MerchantLimitOutOfRange = "Limit must be between 1 and 20.";

    public const string BulkActionRequired = "Choose an action.";
    public const string BulkSelectionEmpty = "Select at least one transaction.";
    public const string BulkSelectionTooLarge = "Select at most 500 transactions at once.";
    public const string BulkTransfersHaveNoCategory = "Transfers don't have a category. Unselect them first.";
    public const string BulkMixedTypes = "Select only expenses or only income to change their category.";

    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 200;
    public const int SearchMaxLength = 100;
    public const int MerchantDefaultLimit = 10;
    public const int MerchantMaxLimit = 20;
    public const int BulkMaxCount = 500;

    /// <summary>The latest allowed transaction date: tomorrow, as slack for time zones (FEATURES.md F3).</summary>
    public static DateOnly MaxDate(BusinessClock clock) => clock.Today.AddDays(1);

    /// <summary>Trims optional text; blank becomes null.</summary>
    public static string? NormalizeText(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    /// <summary>
    /// Whether a transaction of this type may use a category of that type (PLAN.md §6): an expense needs an expense
    /// category; income may use an income category or an expense category (a refund, which lowers Spent).
    /// </summary>
    public static bool CategoryFits(TransactionType transactionType, CategoryType categoryType) =>
        transactionType switch
        {
            TransactionType.Expense => categoryType == CategoryType.Expense,
            TransactionType.Income => true,
            _ => false,
        };

    /// <summary>
    /// Parses <c>sort</c> through the allow-list: a field name, optionally prefixed with <c>-</c> for descending.
    /// Omitted means newest first.
    /// </summary>
    public static bool TryParseSort(string? sort, out TransactionSort result)
    {
        result = new TransactionSort(TransactionSortField.Date, Descending: true);
        if (string.IsNullOrWhiteSpace(sort))
        {
            return true;
        }

        var text = sort.Trim();
        var descending = text.StartsWith('-');
        var name = descending ? text[1..] : text;
        if (name.Length == 0
            || !char.IsLetter(name[0])
            || !Enum.TryParse<TransactionSortField>(name, ignoreCase: true, out var field)
            || !Enum.IsDefined(field))
        {
            return false;
        }

        result = new TransactionSort(field, descending);
        return true;
    }
}

/// <summary>Amount rules shared by transactions and transfers.</summary>
internal static class AmountRuleExtensions
{
    public static IRuleBuilderOptions<T, decimal?> ValidAmount<T>(this IRuleBuilderInitial<T, decimal?> rule) =>
        rule
            .Cascade(CascadeMode.Stop)
            .Must(amount => amount is > 0m).WithMessage(TransactionRules.AmountRequired)
            .Must(amount => Money.HasAtMostTwoDecimalPlaces(amount!.Value))
            .WithMessage(TransactionRules.AmountTooManyDecimals)
            .Must(amount => amount <= Money.MaxAmount).WithMessage(TransactionRules.AmountTooLarge);

    public static IRuleBuilderOptions<T, DateOnly?> ValidTransactionDate<T>(
        this IRuleBuilderInitial<T, DateOnly?> rule,
        BusinessClock clock) =>
        rule
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(TransactionRules.DateRequired)
            .Must(date => date <= TransactionRules.MaxDate(clock)).WithMessage(TransactionRules.DateInFuture);

    public static IRuleBuilderOptions<T, Guid?> RequiredId<T>(this IRuleBuilder<T, Guid?> rule, string message) =>
        rule.Must(id => id is not null && id != Guid.Empty).WithMessage(message);

    public static IRuleBuilderOptions<T, string?> MaxTrimmedLength<T>(
        this IRuleBuilder<T, string?> rule,
        int maxLength,
        string message) =>
        rule.Must(text => text is null || text.Trim().Length <= maxLength).WithMessage(message);
}

public sealed class TransactionRequestValidator : AbstractValidator<TransactionRequest>
{
    public TransactionRequestValidator(BusinessClock clock)
    {
        RuleFor(r => r.Type)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(TransactionRules.TypeRequired)
            .IsInEnum().WithMessage(TransactionRules.TypeRequired)
            .NotEqual(TransactionType.Transfer).WithMessage(TransactionRules.TypeNotTransfer);

        RuleFor(r => r.Amount).ValidAmount();
        RuleFor(r => r.Date).ValidTransactionDate(clock);
        RuleFor(r => r.AccountId).RequiredId(TransactionRules.AccountRequired);
        RuleFor(r => r.CategoryId).RequiredId(TransactionRules.CategoryRequired);
        RuleFor(r => r.Merchant).MaxTrimmedLength(Transaction.MerchantMaxLength, TransactionRules.MerchantTooLong);
        RuleFor(r => r.Note).MaxTrimmedLength(Transaction.NoteMaxLength, TransactionRules.NoteTooLong);
    }
}

public sealed class TransferRequestValidator : AbstractValidator<TransferRequest>
{
    public TransferRequestValidator(BusinessClock clock)
    {
        RuleFor(r => r.FromAccountId).RequiredId(TransactionRules.FromAccountRequired);

        RuleFor(r => r.ToAccountId)
            .Cascade(CascadeMode.Stop)
            .RequiredId(TransactionRules.ToAccountRequired)
            .Must((request, to) => to != request.FromAccountId).WithMessage(TransactionRules.SameAccounts);

        RuleFor(r => r.Amount).ValidAmount();
        RuleFor(r => r.Date).ValidTransactionDate(clock);
        RuleFor(r => r.Note).MaxTrimmedLength(Transaction.NoteMaxLength, TransactionRules.NoteTooLong);
    }
}

public sealed class TransactionListQueryValidator : AbstractValidator<TransactionListQuery>
{
    public TransactionListQueryValidator()
    {
        RuleFor(q => q.To)
            .Must((query, to) => query.From is null || to is null || to >= query.From)
            .WithMessage(TransactionRules.DateRangeReversed);

        RuleFor(q => q.Type).IsInEnum().WithMessage(TransactionRules.TypeRequired);

        RuleFor(q => q.MinAmount)
            .Must(amount => amount is null or >= 0m).WithMessage(TransactionRules.FilterAmountNegative);

        RuleFor(q => q.MaxAmount)
            .Cascade(CascadeMode.Stop)
            .Must(amount => amount is null or >= 0m).WithMessage(TransactionRules.FilterAmountNegative)
            .Must((query, max) => query.MinAmount is null || max is null || max >= query.MinAmount)
            .WithMessage(TransactionRules.AmountRangeReversed);

        RuleFor(q => q.Q)
            .MaxTrimmedLength(TransactionRules.SearchMaxLength, TransactionRules.SearchTooLong);

        RuleFor(q => q.Page).GreaterThanOrEqualTo(1).WithMessage(TransactionRules.PageOutOfRange);

        RuleFor(q => q.PageSize)
            .InclusiveBetween(1, TransactionRules.MaxPageSize)
            .WithMessage(TransactionRules.PageSizeOutOfRange);

        RuleFor(q => q.Sort)
            .Must(sort => TransactionRules.TryParseSort(sort, out _))
            .WithMessage(TransactionRules.SortUnknown);
    }
}

public sealed class MerchantQueryValidator : AbstractValidator<MerchantQuery>
{
    public MerchantQueryValidator()
    {
        RuleFor(q => q.Q).MaxTrimmedLength(TransactionRules.SearchMaxLength, TransactionRules.SearchTooLong);

        RuleFor(q => q.Limit)
            .InclusiveBetween(1, TransactionRules.MerchantMaxLimit)
            .WithMessage(TransactionRules.MerchantLimitOutOfRange);
    }
}

public sealed class BulkTransactionRequestValidator : AbstractValidator<BulkTransactionRequest>
{
    public BulkTransactionRequestValidator()
    {
        RuleFor(r => r.Action)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(TransactionRules.BulkActionRequired)
            .IsInEnum().WithMessage(TransactionRules.BulkActionRequired);

        RuleFor(r => r.TransactionIds)
            .Cascade(CascadeMode.Stop)
            .Must(ids => ids is { Count: > 0 } && ids.Any(id => id != Guid.Empty))
            .WithMessage(TransactionRules.BulkSelectionEmpty)
            .Must(ids => ids!.Distinct().Count() <= TransactionRules.BulkMaxCount)
            .WithMessage(TransactionRules.BulkSelectionTooLarge);

        RuleFor(r => r.CategoryId)
            .RequiredId(TransactionRules.CategoryRequired)
            .When(r => r.Action == BulkTransactionAction.Recategorize);
    }
}
