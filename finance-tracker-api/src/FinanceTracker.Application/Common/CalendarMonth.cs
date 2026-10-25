using System.Globalization;
using FluentValidation;

namespace FinanceTracker.Application.Common;

/// <summary>
/// A calendar month in the API: the invariant text <c>YYYY-MM</c> (e.g. <c>2026-10</c>), stored as the first day of
/// that month.
/// </summary>
public static class CalendarMonth
{
    public const string MonthRequired = "Choose a month.";
    public const string MonthInvalid = "Enter a month as YYYY-MM.";

    private const string _format = "yyyy-MM";

    /// <summary>
    /// Parses <c>YYYY-MM</c> (four-digit year 0001–9999, two-digit month 01–12, surrounding whitespace ignored) to the
    /// first day of that month. Anything else, including a missing value, fails.
    /// </summary>
    public static bool TryParse(string? text, out DateOnly firstDay)
    {
        firstDay = default;
        if (text is null)
        {
            return false;
        }

        var value = text.Trim();
        if (value.Length != 7 || value[4] != '-')
        {
            return false;
        }

        for (var i = 0; i < value.Length; i++)
        {
            if (i != 4 && !char.IsAsciiDigit(value[i]))
            {
                return false;
            }
        }

        var year = int.Parse(value.AsSpan(0, 4), NumberStyles.None, CultureInfo.InvariantCulture);
        var month = int.Parse(value.AsSpan(5, 2), NumberStyles.None, CultureInfo.InvariantCulture);
        if (year < 1 || month is < 1 or > 12)
        {
            return false;
        }

        firstDay = new DateOnly(year, month, 1);
        return true;
    }

    /// <summary>Formats a month (any day in it) as <c>YYYY-MM</c>.</summary>
    public static string ToText(DateOnly month) => month.ToString(_format, CultureInfo.InvariantCulture);

    /// <summary>A required <c>YYYY-MM</c> month: "Choose a month." when missing, "Enter a month as YYYY-MM." when unreadable.</summary>
    public static IRuleBuilderOptions<T, string?> ValidMonth<T>(this IRuleBuilderInitial<T, string?> rule) =>
        rule
            .Cascade(CascadeMode.Stop)
            .Must(text => !string.IsNullOrWhiteSpace(text)).WithMessage(MonthRequired)
            .Must(text => TryParse(text, out _)).WithMessage(MonthInvalid);
}
