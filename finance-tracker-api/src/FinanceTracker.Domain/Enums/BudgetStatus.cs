namespace FinanceTracker.Domain.Enums;

/// <summary>
/// How much of a monthly limit is used: Ok below 80%, Warning from 80% to below 100%, Over at 100% or more.
/// Declared from least to most used; alerts compare the values to detect an upward move.
/// </summary>
public enum BudgetStatus
{
    Ok,
    Warning,
    Over,
}
