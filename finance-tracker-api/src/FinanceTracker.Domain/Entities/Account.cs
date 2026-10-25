using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>
/// A place where the user keeps money (card, savings, cash). The balance is always computed
/// from <see cref="InitialBalance"/> and the account's transactions, never stored.
/// </summary>
public sealed class Account
{
    public const int NameMaxLength = 50;
    public const int CurrencyLength = 3;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Name { get; set; }

    public AccountType Type { get; set; }

    /// <summary>ISO 4217 code. Only PLN (<see cref="Constants.Money.Pln"/>) is supported in the MVP.</summary>
    public required string Currency { get; set; }

    public decimal InitialBalance { get; set; }

    public bool IsArchived { get; set; }
}
