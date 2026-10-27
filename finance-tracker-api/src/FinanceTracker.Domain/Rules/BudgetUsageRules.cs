using System.Linq.Expressions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Rules;

/// <summary>
/// Budget usage (PLAN.md §6 Budgets, FEATURES.md F6). Spent = expenses − refunds (income in the expense category),
/// floored at 0; transfers never count. Remaining = Limit − Spent; Usage = Spent ÷ Limit; Status Ok below 80%,
/// Warning from 80% to below 100%, Over at 100% or more.
/// </summary>
public static class BudgetUsageRules
{
    /// <summary>Decimal places of <c>usage</c> in API responses (e.g. <c>0.8125</c>).</summary>
    public const int UsageDecimals = 4;

    /// <summary>
    /// A transaction's contribution to the Spent of its expense category: an expense adds its amount, income in an
    /// expense category (a refund) subtracts it. Only valid for non-transfer rows of expense categories. An
    /// expression so that the sum runs in the database.
    /// </summary>
    public static readonly Expression<Func<Transaction, decimal>> SignedSpending = t =>
        t.Type == TransactionType.Expense ? t.Amount : -t.Amount;

    /// <summary>Displayed Spent: refunds can lower it, but never below 0.</summary>
    public static decimal FloorSpent(decimal netSpending) => Math.Max(netSpending, 0m);

    /// <summary>
    /// Spent ÷ Limit truncated to <see cref="UsageDecimals"/> places. Truncation (not rounding) keeps the value
    /// consistent with <see cref="StatusOf"/>: 0.79999 shows as 0.7999 (Ok), never 0.8000.
    /// </summary>
    public static decimal UsageOf(decimal spent, decimal limit) =>
        Math.Round(spent / limit, UsageDecimals, MidpointRounding.ToZero);

    /// <summary>
    /// Spent ÷ Limit as a whole percentage, rounded down so it never disagrees with <see cref="StatusOf"/>
    /// (99.99% shows as 99, not 100). Capped at <see cref="int.MaxValue"/> for absurdly small limits.
    /// </summary>
    public static int PercentOf(decimal spent, decimal limit) =>
        (int)Math.Min(Math.Floor(spent * 100m / limit), int.MaxValue);

    /// <summary>The status of <paramref name="spent"/> against a positive <paramref name="limit"/>, compared exactly.</summary>
    public static BudgetStatus StatusOf(decimal spent, decimal limit)
    {
        if (spent >= limit)
        {
            return BudgetStatus.Over;
        }

        // spent ≥ 80% of limit, without dividing (no rounding at the boundary).
        return spent * 5m >= limit * 4m ? BudgetStatus.Warning : BudgetStatus.Ok;
    }

    /// <summary>
    /// What can still be spent per day: max(total remaining, 0) ÷ days left (today included), rounded down to whole
    /// grosze, so it never suggests more than is left.
    /// </summary>
    public static decimal DailyAllowance(decimal totalRemaining, int daysLeft) =>
        Math.Round(Math.Max(totalRemaining, 0m) / daysLeft, 2, MidpointRounding.ToZero);
}
