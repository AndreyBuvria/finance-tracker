namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>
/// An <see cref="ApiFactory"/> whose clock is 30 Sep 2026 22:30 UTC, which is already 1 Oct 00:30 in Warsaw
/// (CEST, UTC+2): the UTC month is still September, the business month is October.
/// </summary>
public sealed class WarsawMonthStartApiFactory() : ApiFactory(UtcNow)
{
    public static readonly DateTimeOffset UtcNow = new(2026, 9, 30, 22, 30, 0, TimeSpan.Zero);

    /// <summary>The Europe/Warsaw calendar date at <see cref="UtcNow"/>.</summary>
    public static readonly DateOnly WarsawToday = new(2026, 10, 1);
}
