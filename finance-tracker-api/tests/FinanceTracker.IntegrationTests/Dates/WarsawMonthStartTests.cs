using FinanceTracker.Application.Common;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;

namespace FinanceTracker.IntegrationTests.Dates;

/// <summary>
/// The business month follows Europe/Warsaw (PLAN.md §6 Dates). The clock here is 30 Sep 2026 22:30 UTC, which is
/// already 1 Oct 00:30 in Warsaw, so October is the current month although the UTC month is still September.
/// </summary>
public sealed class WarsawMonthStartTests(WarsawMonthStartApiFactory factory) : IClassFixture<WarsawMonthStartApiFactory>
{
    private static readonly DateOnly _warsawToday = WarsawMonthStartApiFactory.WarsawToday;

    [Fact]
    public async Task ListBudgets_FirstDayInWarsaw_OctoberIsCurrentWithAllDaysLeft()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-10", 310m);

        var october = await client.GetBudgetsAsync("2026-10");
        var september = await client.GetBudgetsAsync("2026-09");

        october.Period.Should().Be(MonthPeriod.Current);
        october.DaysLeft.Should().Be(31);
        october.Totals!.DailyAllowance.Should().Be(10m);
        september.Period.Should().Be(MonthPeriod.Past);
        september.DaysLeft.Should().BeNull();
    }

    [Fact]
    public async Task CreateTransaction_FirstDayInWarsaw_AlertsOctoberButNotSeptember()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-09", 100m);
        await client.SetBudgetAsync(groceries, "2026-10", 100m);

        await AddExpenseAsync(client, account.Id, groceries, 150m, _warsawToday.AddDays(-1));
        await AddExpenseAsync(client, account.Id, groceries, 90m, _warsawToday);

        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Month = "2026-10",
            DaysLeft = 31,
        });
    }

    private static Task<TransactionResponse> AddExpenseAsync(
        HttpClient client,
        Guid accountId,
        Guid categoryId,
        decimal amount,
        DateOnly date) =>
        client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Expense, amount, date, accountId, categoryId, null, null));
}
