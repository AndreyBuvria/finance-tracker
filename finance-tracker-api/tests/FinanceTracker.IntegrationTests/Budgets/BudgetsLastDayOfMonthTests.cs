using FinanceTracker.Application.Common;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;

namespace FinanceTracker.IntegrationTests.Budgets;

/// <summary>
/// Budgets on the last day of the month (31 Oct 2026 23:30 in Warsaw): one day left (today), so the daily allowance
/// is all of the remainder, and "tomorrow" is already in the next month.
/// </summary>
public sealed class BudgetsLastDayOfMonthTests(LastDayOfMonthApiFactory factory) : IClassFixture<LastDayOfMonthApiFactory>
{
    private static readonly DateOnly _today = LastDayOfMonthApiFactory.WarsawToday;

    [Fact]
    public async Task List_LastDayOfCurrentMonth_DailyAllowanceIsWholeRemainder()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var categories = await client.GetCategoriesAsync();
        var groceries = categories["groceries"].Id;
        var eatingOut = categories["eating_out"].Id;
        await client.SetBudgetAsync(groceries, "2026-10", 500m);
        await client.SetBudgetAsync(eatingOut, "2026-10", 100m);
        await AddExpenseAsync(client, account.Id, groceries, 123.45m, _today);
        await AddExpenseAsync(client, account.Id, eatingOut, 150m, _today);

        var october = await client.GetBudgetsAsync("2026-10");
        var november = await client.GetBudgetsAsync("2026-11");

        // Groceries +376.55, Eating out −50 → 326.55 for the one day left.
        october.Period.Should().Be(MonthPeriod.Current);
        october.DaysLeft.Should().Be(1);
        october.Items.Single(i => i.Category.Id == eatingOut).Status.Should().Be(BudgetStatus.Over);
        october.Totals.Should().BeEquivalentTo(new
        {
            Limit = 600m,
            Spent = 273.45m,
            Remaining = 326.55m,
            Status = BudgetStatus.Ok,
            DailyAllowance = 326.55m,
        });
        november.Period.Should().Be(MonthPeriod.Future);
        november.DaysLeft.Should().BeNull();
    }

    [Fact]
    public async Task List_FutureMonthWithSpendingDatedTomorrow_ShowsThatSpending()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-11", 200m);
        await AddExpenseAsync(client, account.Id, groceries, 45.50m, _today.AddDays(1));

        var november = await client.GetBudgetsAsync("2026-11");
        var october = await client.GetBudgetsAsync("2026-10");

        november.Period.Should().Be(MonthPeriod.Future);
        november.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Spent = 45.50m,
            Remaining = 154.50m,
            Status = BudgetStatus.Ok,
        });
        november.Totals!.DailyAllowance.Should().BeNull();
        october.Unbudgeted.Total.Should().Be(0m);
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
