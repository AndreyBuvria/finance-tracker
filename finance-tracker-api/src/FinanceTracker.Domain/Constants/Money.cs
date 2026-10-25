namespace FinanceTracker.Domain.Constants;

/// <summary>Money rules shared by every amount the user enters (stored as <c>numeric(18,2)</c>).</summary>
public static class Money
{
    /// <summary>The only currency supported in the MVP.</summary>
    public const string Pln = "PLN";

    public const int DecimalPlaces = 2;

    /// <summary>The largest magnitude that fits <c>numeric(18,2)</c>.</summary>
    public const decimal MaxAmount = 9_999_999_999_999_999.99m;

    public static bool HasAtMostTwoDecimalPlaces(decimal amount) => decimal.Round(amount, DecimalPlaces) == amount;
}
