using System.Linq.Expressions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Rules;

/// <summary>
/// Balance = InitialBalance + income − expenses − transfers out + transfers in (PLAN.md §6 Balances).
/// Balances are always computed from transactions, never stored.
/// </summary>
public static class BalanceRules
{
    /// <summary>
    /// A transaction's effect on its account's balance: income and incoming transfers add their amount,
    /// expenses and outgoing transfers subtract it. An expression so that balance queries run in the database.
    /// </summary>
    public static readonly Expression<Func<Transaction, decimal>> SignedAmount = t =>
        t.Type == TransactionType.Income
        || (t.Type == TransactionType.Transfer && t.TransferDirection == TransferDirection.In)
            ? t.Amount
            : -t.Amount;
}
