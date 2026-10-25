namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>
/// An <see cref="ApiFactory"/> whose clock is 21 Oct 2026 22:30 UTC, which is already 22 Oct 00:30 in Warsaw
/// (CEST, UTC+2): the UTC date and the business date differ.
/// </summary>
public sealed class WarsawAfterMidnightApiFactory() : ApiFactory(UtcNow)
{
    public static readonly DateTimeOffset UtcNow = new(2026, 10, 21, 22, 30, 0, TimeSpan.Zero);

    /// <summary>The Europe/Warsaw calendar date at <see cref="UtcNow"/>.</summary>
    public static readonly DateOnly WarsawToday = new(2026, 10, 22);
}
