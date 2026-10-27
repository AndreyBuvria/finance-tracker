namespace FinanceTracker.Application.Common;

/// <summary>
/// The business calendar (PLAN.md §6 Dates): "today" is the Europe/Warsaw calendar date of the injected
/// <see cref="TimeProvider"/>, used for date validation, the 90-day top-categories window, months and the daily
/// allowance. Use <see cref="TimeProvider"/> directly only for UTC timestamps.
/// </summary>
public sealed class BusinessClock(TimeProvider timeProvider)
{
    /// <summary>IANA ID of the time zone that defines the user's calendar day.</summary>
    public const string TimeZoneId = "Europe/Warsaw";

    /// <summary>Resolved once; fails fast at first use if the host has no time zone data.</summary>
    private static readonly TimeZoneInfo _timeZone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    /// <summary>The current Europe/Warsaw calendar date.</summary>
    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), _timeZone).DateTime);

    /// <summary>Whether <paramref name="month"/> (its first day) is before, at or after the month of <paramref name="today"/>.</summary>
    public static MonthPeriod PeriodOf(DateOnly month, DateOnly today)
    {
        var currentMonth = new DateOnly(today.Year, today.Month, 1);
        return month < currentMonth ? MonthPeriod.Past
            : month == currentMonth ? MonthPeriod.Current
            : MonthPeriod.Future;
    }

    /// <summary>Days left in the month of <paramref name="today"/>, today included (1 on the last day).</summary>
    public static int DaysLeftInMonth(DateOnly today) => DateTime.DaysInMonth(today.Year, today.Month) - today.Day + 1;
}
