using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Common;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.IntegrationTests.Budgets;

/// <summary>
/// <c>GET /budgets?month=YYYY-MM</c> (PLAN.md §6 Budgets, §7 Budgets contract Phase 2). The clock is
/// 21 Oct 2026 12:00 in Warsaw, so October has 11 days left including today.
/// </summary>
public sealed class BudgetsListEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _october = "2026-10";

    private static readonly DateOnly _today = new(2026, 10, 21);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task List_RefundInExpenseCategory_ReducesSpent()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 1000m);
        await AddAsync(client, TransactionType.Expense, 300m, account, groceries);
        await AddAsync(client, TransactionType.Income, 50m, account, groceries);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Category = new { Id = groceries, Name = "Groceries", Icon = "shopping_cart", Color = "#2e7d32" },
            LimitAmount = 1000m,
            Spent = 250m,
            Remaining = 750m,
            Usage = 0.25m,
            Status = BudgetStatus.Ok,
        });
    }

    [Fact]
    public async Task List_RefundsAboveExpenses_SpentIsFlooredAtZero()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var shopping = categories["shopping"];
        var eatingOut = categories["eating_out"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(eatingOut, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 20m, account, groceries);
        await AddAsync(client, TransactionType.Income, 50m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 30m, account, eatingOut);
        await AddAsync(client, TransactionType.Income, 80m, account, shopping);

        var budgets = await client.GetBudgetsAsync(_october);

        var groceriesItem = budgets.Items.Single(i => i.Category.Id == groceries);
        groceriesItem.Spent.Should().Be(0m);
        groceriesItem.Remaining.Should().Be(100m);
        groceriesItem.Usage.Should().Be(0m);
        // The negative groceries balance doesn't offset other categories in the totals.
        budgets.Totals.Should().BeEquivalentTo(new { Limit = 200m, Spent = 30m, Remaining = 170m, Usage = 0.15m });
        budgets.Unbudgeted.Items.Single(u => u.Category.Id == shopping).Spent.Should().Be(0m);
        budgets.Unbudgeted.Total.Should().Be(0m);
    }

    [Fact]
    public async Task List_Transfers_AreExcluded()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        await client.SetBudgetAsync(categories["groceries"], _october, 100m);
        await client.CreateTransferAsync(new TransferRequest(account, savings.Id, 500m, _today, null));
        await client.CreateTransferAsync(new TransferRequest(savings.Id, account, 200m, _today, null));

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Should().ContainSingle().Which.Spent.Should().Be(0m);
        budgets.Totals!.Spent.Should().Be(0m);
        budgets.Unbudgeted.Total.Should().Be(0m);
        budgets.Unbudgeted.Items.Should().OnlyContain(u => u.Spent == 0m);
    }

    [Theory]
    [InlineData("100", "79.99", "0.7999", BudgetStatus.Ok)]
    [InlineData("100", "80", "0.8", BudgetStatus.Warning)]
    [InlineData("100", "99.99", "0.9999", BudgetStatus.Warning)]
    [InlineData("100", "100", "1", BudgetStatus.Over)]
    [InlineData("100", "150.5", "1.505", BudgetStatus.Over)]
    [InlineData("1000", "799.99", "0.7999", BudgetStatus.Ok)]
    [InlineData("1000", "999.99", "0.9999", BudgetStatus.Warning)]
    [InlineData("3", "2.99", "0.9966", BudgetStatus.Warning)]
    public async Task List_StatusThresholds_FollowExactUsage(
        string limit,
        string spent,
        string expectedUsage,
        BudgetStatus expectedStatus)
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, decimal.Parse(limit, CultureInfo.InvariantCulture));
        await AddAsync(client, TransactionType.Expense, decimal.Parse(spent, CultureInfo.InvariantCulture), account, groceries);

        var budgets = await client.GetBudgetsAsync(_october);

        var item = budgets.Items.Should().ContainSingle().Subject;
        item.Usage.Should().Be(decimal.Parse(expectedUsage, CultureInfo.InvariantCulture));
        item.Status.Should().Be(expectedStatus);
        budgets.Totals!.Status.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task List_OverBudgetCategories_TotalRemainingIsNegative()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var eatingOut = categories["eating_out"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(eatingOut, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 250m, account, groceries);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Single(i => i.Category.Id == groceries).Remaining.Should().Be(-150m);
        budgets.Totals.Should().BeEquivalentTo(new BudgetTotalsResponse(200m, 250m, -50m, 1.25m, BudgetStatus.Over, 0m));
    }

    [Fact]
    public async Task List_OneItemOverButTotalBelowWarning_OverallStatusIsOk()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var housing = categories["housing"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(housing, _october, 2000m);
        await AddAsync(client, TransactionType.Expense, 150m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 500m, account, housing);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Single(i => i.Category.Id == groceries).Status.Should().Be(BudgetStatus.Over);
        budgets.Items.Single(i => i.Category.Id == housing).Status.Should().Be(BudgetStatus.Ok);
        // 650 of 2100 is 30.95%: the overall status follows the totals, not the worst item.
        budgets.Totals.Should().BeEquivalentTo(new
        {
            Limit = 2100m,
            Spent = 650m,
            Remaining = 1450m,
            Usage = 0.3095m,
            Status = BudgetStatus.Ok,
        });
    }

    [Fact]
    public async Task List_PreviousMonthHasLimitMissingHere_CanCopyFromPreviousMonth()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], "2026-09", 500m);
        await client.SetBudgetAsync(categories["transport"], "2026-09", 100m);
        await client.SetBudgetAsync(categories["groceries"], _october, 600m);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.CanCopyFromPreviousMonth.Should().BeTrue();
    }

    [Fact]
    public async Task List_PreviousMonthLimitsAllSetHere_CannotCopyFromPreviousMonth()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], "2026-09", 500m);
        await client.SetBudgetAsync(categories["groceries"], _october, 600m);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.CanCopyFromPreviousMonth.Should().BeFalse();
        (await client.CopyBudgetsAsync($"?from=2026-09&to={_october}")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task List_PreviousMonthOnlyHiddenCategoryLimits_CannotCopyFromPreviousMonth()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["health"], "2026-09", 100m);
        await ArchiveCategoryAsync(client, categories["health"]);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.CanCopyFromPreviousMonth.Should().BeFalse();
    }

    [Fact]
    public async Task List_PreviousMonthEmptyOrOtherMonthsOnly_CannotCopyFromPreviousMonth()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], "2026-08", 500m);
        await client.SetBudgetAsync(categories["groceries"], "2026-11", 500m);

        var october = await client.GetBudgetsAsync(_october);
        var december = await client.GetBudgetsAsync("2026-12");

        october.CanCopyFromPreviousMonth.Should().BeFalse();
        december.CanCopyFromPreviousMonth.Should().BeTrue();
    }

    [Fact]
    public async Task List_JanuaryWithDecemberLimits_CanCopyAcrossYearBoundary()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], "2026-12", 500m);

        var january = await client.GetBudgetsAsync("2027-01");

        january.CanCopyFromPreviousMonth.Should().BeTrue();
    }

    [Fact]
    public async Task List_CurrentMonth_ReturnsDaysLeftAndDailyAllowanceRoundedDown()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var eatingOut = categories["eating_out"];
        await client.SetBudgetAsync(groceries, _october, 200m);
        await client.SetBudgetAsync(eatingOut, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 100m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 150m, account, eatingOut);

        var budgets = await client.GetBudgetsAsync(_october);

        // Groceries +100, Eating out −50 → 50 left for 11 days (21–31 Oct) = 4.545… → 4.54.
        budgets.Month.Should().Be(_october);
        budgets.Period.Should().Be(MonthPeriod.Current);
        budgets.DaysLeft.Should().Be(11);
        budgets.Totals.Should().BeEquivalentTo(new { Remaining = 50m, DailyAllowance = 4.54m });
    }

    [Fact]
    public async Task List_CurrentMonthWithoutBudgets_HasDaysLeftButNoTotals()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        await AddAsync(client, TransactionType.Expense, 10m, account, categories["groceries"]);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Period.Should().Be(MonthPeriod.Current);
        budgets.DaysLeft.Should().Be(11);
        budgets.Items.Should().BeEmpty();
        budgets.Totals.Should().BeNull();
        budgets.Unbudgeted.Total.Should().Be(10m);
    }

    [Fact]
    public async Task List_PastMonth_CountsSpendingWithoutDaysLeftOrDailyAllowance()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, "2026-09", 100m);
        await AddAsync(client, TransactionType.Expense, 40m, account, groceries, new DateOnly(2026, 9, 15));

        var budgets = await client.GetBudgetsAsync("2026-09");

        budgets.Period.Should().Be(MonthPeriod.Past);
        budgets.DaysLeft.Should().BeNull();
        budgets.Items.Should().ContainSingle().Which.Spent.Should().Be(40m);
        budgets.Totals.Should().BeEquivalentTo(new BudgetTotalsResponse(100m, 40m, 60m, 0.4m, BudgetStatus.Ok, null));
    }

    [Fact]
    public async Task List_FutureMonth_ShowsBudgetsWithoutDaysLeftOrDailyAllowance()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, "2026-11", 300m);
        await AddAsync(client, TransactionType.Expense, 40m, account, groceries);

        var budgets = await client.GetBudgetsAsync("2026-11");

        budgets.Month.Should().Be("2026-11");
        budgets.Period.Should().Be(MonthPeriod.Future);
        budgets.DaysLeft.Should().BeNull();
        budgets.Totals.Should().BeEquivalentTo(new BudgetTotalsResponse(300m, 0m, 300m, 0m, BudgetStatus.Ok, null));
    }

    [Fact]
    public async Task List_TransactionsOnMonthBoundaries_CountOnlyInTheirMonth()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, "2026-09", 1000m);
        await AddAsync(client, TransactionType.Expense, 1m, account, groceries, new DateOnly(2026, 8, 31));
        await AddAsync(client, TransactionType.Expense, 10m, account, groceries, new DateOnly(2026, 9, 1));
        await AddAsync(client, TransactionType.Expense, 100m, account, groceries, new DateOnly(2026, 9, 30));
        await AddAsync(client, TransactionType.Expense, 1000m, account, groceries, new DateOnly(2026, 10, 1));

        var budgets = await client.GetBudgetsAsync("2026-09");

        budgets.Items.Should().ContainSingle().Which.Spent.Should().Be(110m);
    }

    [Fact]
    public async Task List_Unbudgeted_IncludesActiveCategoriesWithoutLimitAndHiddenOnesWithSpending()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var health = categories["health"];
        var entertainment = categories["entertainment"];
        var shopping = categories["shopping"];
        await client.SetBudgetAsync(groceries, _october, 500m);
        await client.SetBudgetAsync(health, _october, 50m);
        await client.SetBudgetAsync(entertainment, _october, 70m);
        await AddAsync(client, TransactionType.Expense, 100m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 40m, account, shopping);
        await AddAsync(client, TransactionType.Expense, 30m, account, health);
        await ArchiveCategoryAsync(client, health);
        await ArchiveCategoryAsync(client, entertainment);

        var budgets = await client.GetBudgetsAsync(_october);

        // Hidden categories' budgets are left out of the items and totals.
        budgets.Items.Select(i => i.Category.Id).Should().Equal(groceries);
        budgets.Totals.Should().BeEquivalentTo(new { Limit = 500m, Spent = 100m });
        // By spent (highest first), then name; zero-spent active categories are listed, hidden ones only with spending.
        budgets.Unbudgeted.Items.Select(u => (u.Category.Name, u.Spent, u.Category.IsArchived)).Should().Equal(
            ("Shopping", 40m, false),
            ("Health", 30m, true),
            ("Eating out", 0m, false),
            ("Housing", 0m, false),
            ("Other", 0m, false),
            ("Subscriptions", 0m, false),
            ("Transport", 0m, false),
            ("Utilities", 0m, false));
        budgets.Unbudgeted.Total.Should().Be(70m);
    }

    [Fact]
    public async Task List_IncomeCategories_NeverAppear()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        await AddAsync(client, TransactionType.Income, 5000m, account, categories["salary"]);
        await AddAsync(client, TransactionType.Income, 100m, account, categories["other_income"]);

        var budgets = await client.GetBudgetsAsync(_october);

        var incomeIds = new[] { categories["salary"], categories["other_income"] };
        budgets.Items.Should().BeEmpty();
        budgets.Unbudgeted.Items.Select(u => u.Category.Id).Should().NotContain(incomeIds);
        budgets.Unbudgeted.Items.Should().HaveCount(10);
        budgets.Unbudgeted.Total.Should().Be(0m);
    }

    [Fact]
    public async Task List_TransactionsOfArchivedAccount_StillCount()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var cash = await client.CreateAccountResponseAsync("Cash", AccountType.Cash);
        await client.SetBudgetAsync(groceries, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 20m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 35m, cash.Id, groceries);
        (await client.DeleteAsync($"/api/accounts/{cash.Id}", CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Should().ContainSingle().Which.Spent.Should().Be(55m);
    }

    [Fact]
    public async Task List_Items_AreSortedByNameIgnoringCase()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        var custom = await CreateExpenseCategoryAsync(client, "apples");
        await client.SetBudgetAsync(categories["transport"], _october, 10m);
        await client.SetBudgetAsync(custom, _october, 10m);
        await client.SetBudgetAsync(categories["groceries"], _october, 10m);

        var budgets = await client.GetBudgetsAsync(_october);

        budgets.Items.Select(i => i.Category.Name).Should().Equal("apples", "Groceries", "Transport");
    }

    [Fact]
    public async Task List_NoBudgets_ReturnsEmptyItemsAndNullTotals()
    {
        using var client = await factory.CreateSignedInClientAsync();

        var budgets = await client.GetBudgetsAsync("2025-01");

        budgets.Should().BeEquivalentTo(new
        {
            Month = "2025-01",
            Period = MonthPeriod.Past,
            DaysLeft = (int?)null,
            Items = Array.Empty<BudgetItemResponse>(),
            Totals = (BudgetTotalsResponse?)null,
        });
        budgets.Unbudgeted.Total.Should().Be(0m);
        budgets.Unbudgeted.Items.Should().HaveCount(10);
    }

    [Fact]
    public async Task List_ResponseShape_MatchesContract()
    {
        using var setup = await SetUpAsync();
        var (client, _, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], _october, 100m);

        var json = await client.GetStringAsync($"{BudgetTestExtensions.BudgetsUrl}?month={_october}", CancellationToken);

        json.Should().Contain("\"period\":\"Current\"")
            .And.Contain("\"status\":\"Ok\"")
            .And.Contain("\"daysLeft\":11")
            .And.Contain("\"isArchived\":false")
            .And.Contain("\"dailyAllowance\":")
            .And.Contain("\"canCopyFromPreviousMonth\":false");
    }

    [Theory]
    [InlineData("", "Choose a month.")]
    [InlineData("?month=", "Choose a month.")]
    [InlineData("?month=2026-13", "Enter a month as YYYY-MM.")]
    [InlineData("?month=2026-1", "Enter a month as YYYY-MM.")]
    [InlineData("?month=october", "Enter a month as YYYY-MM.")]
    public async Task List_MissingOrUnreadableMonth_ReturnsMonthFieldError(string query, string expectedMessage)
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await client.GetBudgetsResponseAsync(query);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("month").WhoseValue.Should().Equal(expectedMessage);
    }

    [Fact]
    public async Task List_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.GetBudgetsResponseAsync($"?month={_october}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // User isolation: another user's budgets, categories and spending never show up.

    [Fact]
    public async Task List_OtherUsersBudgetsAndSpending_AreNotVisible()
    {
        using var setupB = await SetUpAsync();
        var (clientB, accountB, categoriesB) = setupB;
        await clientB.SetBudgetAsync(categoriesB["groceries"], _october, 500m);
        await AddAsync(clientB, TransactionType.Expense, 120m, accountB, categoriesB["groceries"]);
        await AddAsync(clientB, TransactionType.Expense, 80m, accountB, categoriesB["shopping"]);
        using var setupA = await SetUpAsync();
        var (clientA, _, categoriesA) = setupA;

        var budgetsA = await clientA.GetBudgetsAsync(_october);
        var budgetsB = await clientB.GetBudgetsAsync(_october);

        budgetsA.Items.Should().BeEmpty();
        budgetsA.Totals.Should().BeNull();
        budgetsA.Unbudgeted.Total.Should().Be(0m);
        budgetsA.Unbudgeted.Items.Select(u => u.Category.Id).Should().BeSubsetOf(categoriesA.Values)
            .And.NotIntersectWith(categoriesB.Values);
        budgetsB.Items.Should().ContainSingle().Which.Spent.Should().Be(120m);
        budgetsB.Unbudgeted.Total.Should().Be(80m);
    }

    [Fact]
    public async Task List_OtherUsersPreviousMonthBudgets_DoNotAllowCopy()
    {
        using var setupB = await SetUpAsync();
        await setupB.Client.SetBudgetAsync(setupB.Categories["groceries"], "2026-09", 500m);
        using var setupA = await SetUpAsync();

        var budgetsA = await setupA.Client.GetBudgetsAsync(_october);

        budgetsA.CanCopyFromPreviousMonth.Should().BeFalse();
        (await setupB.Client.GetBudgetsAsync(_october)).CanCopyFromPreviousMonth.Should().BeTrue();
    }

    private async Task<UserSetup> SetUpAsync()
    {
        var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var categories = (await client.GetCategoriesAsync()).ToDictionary(c => c.Key, c => c.Value.Id);
        return new UserSetup(client, account.Id, categories);
    }

    private static Task AddAsync(
        HttpClient client,
        TransactionType type,
        decimal amount,
        Guid accountId,
        Guid categoryId,
        DateOnly? date = null) =>
        client.CreateTransactionAsync(new TransactionRequest(type, amount, date ?? _today, accountId, categoryId, null, null));

    private static async Task ArchiveCategoryAsync(HttpClient client, Guid categoryId) =>
        (await client.PostAsync($"/api/categories/{categoryId}/archive", null, CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

    private static async Task<Guid> CreateExpenseCategoryAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync(
            "/api/categories",
            new { name, type = "Expense", icon = "category", color = "#546e7a" },
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<CategoryResponse>(
            ApiJson.Options,
            CancellationToken))!.Id;
    }

    /// <summary>A signed-in user with one card account and their categories (by system key or name).</summary>
    private sealed record UserSetup(HttpClient Client, Guid AccountId, IReadOnlyDictionary<string, Guid> Categories)
        : IDisposable
    {
        public void Dispose() => Client.Dispose();
    }
}
