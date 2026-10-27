using FinanceTracker.Application.Common;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Constants;
using FluentValidation;

namespace FinanceTracker.Application.Budgets;

/// <summary>User-facing messages for budgets (PLAN.md §7 Budgets contract, FEATURES.md F6).</summary>
public static class BudgetRules
{
    public const string LimitNegative = TransactionRules.FilterAmountNegative;
    public const string LimitTooManyDecimals = TransactionRules.AmountTooManyDecimals;
    public const string LimitTooLarge = TransactionRules.AmountTooLarge;
    public const string ExpenseCategoryOnly = "Budgets can only be set for expense categories.";
    public const string CategoryArchived = TransactionRules.CategoryArchived;
    public const string CopySameMonth = "Choose a different month to copy to.";
    public const string NothingToCopy = "There are no budgets to copy from that month.";
}

public sealed class SetBudgetCommandValidator : AbstractValidator<SetBudgetCommand>
{
    public SetBudgetCommandValidator()
    {
        RuleFor(c => c.Month).ValidMonth();

        // 0 or null removes the budget; any other limit follows the money rules used for transactions.
        RuleFor(c => c.LimitAmount)
            .Cascade(CascadeMode.Stop)
            .Must(limit => limit is null or >= 0m).WithMessage(BudgetRules.LimitNegative)
            .Must(limit => limit is null || Money.HasAtMostTwoDecimalPlaces(limit.Value))
            .WithMessage(BudgetRules.LimitTooManyDecimals)
            .Must(limit => limit is null || limit <= Money.MaxAmount).WithMessage(BudgetRules.LimitTooLarge);
    }
}

public sealed class BudgetMonthQueryValidator : AbstractValidator<BudgetMonthQuery>
{
    public BudgetMonthQueryValidator() => RuleFor(q => q.Month).ValidMonth();
}

public sealed class CopyBudgetsQueryValidator : AbstractValidator<CopyBudgetsQuery>
{
    public CopyBudgetsQueryValidator()
    {
        RuleFor(q => q.From).ValidMonth();

        // Compared only when both months are readable; an unreadable "from" has its own error.
        RuleFor(q => q.To)
            .ValidMonth()
            .Must((query, to) => !IsSameMonth(query.From, to)).WithMessage(BudgetRules.CopySameMonth);
    }

    private static bool IsSameMonth(string? from, string? to) =>
        CalendarMonth.TryParse(from, out var fromMonth)
        && CalendarMonth.TryParse(to, out var toMonth)
        && fromMonth == toMonth;
}
