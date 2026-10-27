namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>
/// An <see cref="ApiFactory"/> whose clock is 31 Oct 2026 22:30 UTC, i.e. 23:30 on the last day of October in Warsaw
/// (CET, UTC+1, after the end of summer time on 25 Oct).
/// </summary>
public sealed class LastDayOfMonthApiFactory() : ApiFactory(UtcNow)
{
    public static readonly DateTimeOffset UtcNow = new(2026, 10, 31, 22, 30, 0, TimeSpan.Zero);

    /// <summary>The Europe/Warsaw calendar date at <see cref="UtcNow"/>.</summary>
    public static readonly DateOnly WarsawToday = new(2026, 10, 31);
}
