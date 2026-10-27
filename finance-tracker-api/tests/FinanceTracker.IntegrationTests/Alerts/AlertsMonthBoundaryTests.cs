using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;

namespace FinanceTracker.IntegrationTests.Alerts;

/// <summary>
/// Alerts on the last day of the month (31 Oct 2026 23:30 in Warsaw): October is still current with one day left,
/// while spending dated tomorrow belongs to November, a future month that never alerts.
/// </summary>
public sealed class AlertsMonthBoundaryTests(LastDayOfMonthApiFactory factory) : IClassFixture<LastDayOfMonthApiFactory>
{
    private static readonly DateOnly _today = LastDayOfMonthApiFactory.WarsawToday;

    [Fact]
    public async Task CreateTransaction_LastDayOfMonth_SnapshotHasOneDayLeft()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-10", 200m);

        await AddExpenseAsync(client, account.Id, groceries, 170m, _today);

        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Month = "2026-10",
            Percent = 85,
            Amount = 30m,
            DaysLeft = 1,
        });
    }

    [Fact]
    public async Task CreateTransaction_DatedTomorrowInFutureMonth_CreatesNoAlert()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-11", 100m);

        await AddExpenseAsync(client, account.Id, groceries, 150m, _today.AddDays(1));

        (await client.GetBudgetsAsync("2026-11")).Items.Single().Status.Should().Be(BudgetStatus.Over);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
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
