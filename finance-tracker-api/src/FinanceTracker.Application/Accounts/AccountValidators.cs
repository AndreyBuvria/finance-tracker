using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FluentValidation;

namespace FinanceTracker.Application.Accounts;

/// <summary>User-facing messages for account forms (FEATURES.md F2).</summary>
public static class AccountRules
{
    public const string NameRequired = "Enter an account name.";
    public const string NameTooLong = "Name can be at most 50 characters.";
    public const string TypeRequired = "Choose an account type.";
    public const string CurrencyNotSupported = "Only PLN is supported for now.";
    public const string AmountTooManyDecimals = "Enter an amount with at most 2 decimal places.";
    public const string AmountTooLarge = "Enter a smaller amount.";
}

public sealed class AccountRequestValidator : AbstractValidator<AccountRequest>
{
    public AccountRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(AccountRules.NameRequired)
            .Must(name => name.Trim().Length <= Account.NameMaxLength).WithMessage(AccountRules.NameTooLong);

        RuleFor(r => r.Type)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(AccountRules.TypeRequired)
            .IsInEnum().WithMessage(AccountRules.TypeRequired);

        RuleFor(r => r.Currency)
            .Must(currency => currency is null || currency == Money.Pln)
            .WithMessage(AccountRules.CurrencyNotSupported);

        RuleFor(r => r.InitialBalance)
            .Cascade(CascadeMode.Stop)
            .Must(amount => amount is null || Money.HasAtMostTwoDecimalPlaces(amount.Value))
            .WithMessage(AccountRules.AmountTooManyDecimals)
            .Must(amount => amount is null || Math.Abs(amount.Value) <= Money.MaxAmount)
            .WithMessage(AccountRules.AmountTooLarge);
    }
}
