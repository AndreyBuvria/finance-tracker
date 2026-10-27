using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;

namespace FinanceTracker.IntegrationTests.Alerts;

/// <summary>
/// Alerts on threshold crossing (PLAN.md §6 Alerts, FEATURES.md F8). The clock is 21 Oct 2026 12:00 in Warsaw, so
/// October is the current month with 11 days left including today.
/// </summary>
public sealed class AlertsCrossingTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _october = "2026-10";

    private static readonly DateOnly _today = new(2026, 10, 21);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task CreateTransaction_OkToWarning_CreatesWarningAlertWithSnapshot()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 1000m);

        await AddAsync(client, TransactionType.Expense, 925.50m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.UnreadCount.Should().Be(1);
        alerts.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Month = _october,
            Category = new { Id = groceries, Name = "Groceries", Icon = "shopping_cart", Color = "#2e7d32" },
            Percent = 92,
            Amount = 74.50m,
            DaysLeft = 11,
            CreatedAt = factory.Time.GetUtcNow(),
            ReadAt = (DateTimeOffset?)null,
        });
    }

    [Fact]
    public async Task CreateTransaction_OkStraightPastLimit_CreatesOnlyOverAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);

        await AddAsync(client, TransactionType.Expense, 150.75m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Over,
            Percent = 150,
            Amount = 50.75m,
            DaysLeft = 11,
        });
    }

    [Fact]
    public async Task CreateTransaction_WarningToOver_CreatesOverAlertAfterWarning()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);

        await AddAsync(client, TransactionType.Expense, 85m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 20m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Select(a => (a.Level, a.Percent, a.Amount)).Should().BeEquivalentTo(
        [
            (AlertLevel.Over, 105, 5m),
            (AlertLevel.Warning, 85, 15m),
        ]);
        alerts.UnreadCount.Should().Be(2);
    }

    [Fact]
    public async Task CreateTransaction_ExactlyAtThresholds_CreatesWarningThenOver()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);

        await AddAsync(client, TransactionType.Expense, 79.99m, account, groceries);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
        await AddAsync(client, TransactionType.Expense, 0.01m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 19.99m, account, groceries);
        (await client.GetAlertsAsync()).Items.Should().ContainSingle();
        await AddAsync(client, TransactionType.Expense, 0.01m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Select(a => (a.Level, a.Percent, a.Amount)).Should().BeEquivalentTo(
        [
            (AlertLevel.Over, 100, 0m),
            (AlertLevel.Warning, 80, 20m),
        ]);
    }

    [Fact]
    public async Task CreateTransaction_StaysInSameStatus_DoesNotRepeatAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);

        await AddAsync(client, TransactionType.Expense, 85m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 5m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 50m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 50m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Select(a => a.Level).Should().BeEquivalentTo([AlertLevel.Over, AlertLevel.Warning]);
    }

    [Fact]
    public async Task CreateRefund_DownwardMove_CreatesNothingAndCrossingAgainIsNotRepeated()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 90m, account, groceries);

        // Back to Ok through a refund, then up into Warning again.
        await AddAsync(client, TransactionType.Income, 30m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 30m, account, groceries);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Percent = 90,
            Amount = 10m,
        });
    }

    [Fact]
    public async Task SetBudget_LimitLoweredBelowSpending_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 1000m);
        await AddAsync(client, TransactionType.Expense, 90m, account, groceries);

        await client.SetBudgetAsync(groceries, _october, 95m);
        await client.SetBudgetAsync(groceries, _october, 50m);

        (await client.GetBudgetsAsync(_october)).Items.Single().Status.Should().Be(BudgetStatus.Over);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task CopyBudgets_IntoMonthWithSpending_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await AddAsync(client, TransactionType.Expense, 200m, account, groceries);
        await client.SetBudgetAsync(groceries, "2026-09", 100m);

        (await client.CopyBudgetsAsync($"?from=2026-09&to={_october}")).StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.GetBudgetsAsync(_october)).Items.Single().Status.Should().Be(BudgetStatus.Over);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateTransaction_InHiddenCategory_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var health = categories["health"];
        await client.SetBudgetAsync(health, _october, 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 10m, account, health);
        await ArchiveCategoryAsync(client, health);

        // An existing transaction may keep its hidden category when edited.
        await UpdateAsync(client, expense.Id, TransactionType.Expense, 500m, account, health);

        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateTransaction_CategoryWithoutBudget_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        await client.SetBudgetAsync(categories["groceries"], _october, 100m);

        await AddAsync(client, TransactionType.Expense, 5000m, account, categories["shopping"]);
        await AddAsync(client, TransactionType.Income, 5000m, account, categories["salary"]);

        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateTransaction_PastMonth_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, "2026-09", 100m);
        await client.SetBudgetAsync(groceries, _october, 100m);

        await AddAsync(client, TransactionType.Expense, 150m, account, groceries, new DateOnly(2026, 9, 30));

        (await client.GetBudgetsAsync("2026-09")).Items.Single().Status.Should().Be(BudgetStatus.Over);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateTransfer_DoesNotCountAsSpending_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        await client.SetBudgetAsync(categories["groceries"], _october, 100m);

        await client.CreateTransferAsync(new TransferRequest(account, savings.Id, 500m, _today, null));

        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateTransaction_MovedIntoBudgetedCategory_AlertsNewCategory()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var eatingOut = categories["eating_out"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(eatingOut, _october, 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 90m, account, groceries);

        await UpdateAsync(client, expense.Id, TransactionType.Expense, 90m, account, eatingOut);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Select(a => (a.Category.Id, a.Level)).Should().BeEquivalentTo(
        [
            (eatingOut, AlertLevel.Warning),
            (groceries, AlertLevel.Warning),
        ]);
    }

    [Fact]
    public async Task UpdateTransaction_RefundMovedOut_AlertsOldCategory()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var shopping = categories["shopping"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var refund = await AddAsync(client, TransactionType.Income, 50m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 120m, account, groceries);

        // Moving the refund to another category raises Groceries from 70 to 120.
        await UpdateAsync(client, refund.Id, TransactionType.Income, 50m, account, shopping);

        var alerts = await client.GetAlertsAsync();
        alerts.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Over,
            Category = new { Id = groceries },
            Percent = 120,
            Amount = 20m,
        });
    }

    [Fact]
    public async Task UpdateTransaction_MovedFromPastIntoCurrentMonth_CreatesAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 85m, account, groceries, new DateOnly(2026, 9, 15));

        await UpdateAsync(client, expense.Id, TransactionType.Expense, 85m, account, groceries, _today);

        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Level.Should().Be(AlertLevel.Warning);
    }

    [Fact]
    public async Task UpdateTransaction_MovedIntoPastMonth_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, "2026-09", 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 10m, account, groceries);

        await UpdateAsync(client, expense.Id, TransactionType.Expense, 150m, account, groceries, new DateOnly(2026, 9, 15));

        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteTransaction_Refund_RaisesSpendingAndCreatesAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var refund = await AddAsync(client, TransactionType.Income, 20m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 90m, account, groceries);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();

        (await client.DeleteAsync($"{TransactionTestExtensions.TransactionsUrl}/{refund.Id}", CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Percent = 90,
            Amount = 10m,
        });
    }

    [Fact]
    public async Task DeleteTransaction_Expense_CreatesNoFurtherAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 90m, account, groceries);

        (await client.DeleteAsync($"{TransactionTestExtensions.TransactionsUrl}/{expense.Id}", CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Level.Should().Be(AlertLevel.Warning);
    }

    [Fact]
    public async Task BulkDelete_RefundsInTwoCategories_CreatesOneAlertPerCategory()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var eatingOut = categories["eating_out"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(eatingOut, _october, 200m);
        var refundA = await AddAsync(client, TransactionType.Income, 50m, account, groceries);
        var refundB = await AddAsync(client, TransactionType.Income, 100m, account, eatingOut);
        await AddAsync(client, TransactionType.Expense, 110m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 210m, account, eatingOut);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();

        var response = await BulkAsync(client, BulkTransactionAction.Delete, [refundA.Id, refundB.Id], null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAlertsAsync()).Items.Select(a => (a.Category.Id, a.Level, a.Amount))
            .Should().BeEquivalentTo([(groceries, AlertLevel.Over, 10m), (eatingOut, AlertLevel.Over, 10m)]);
    }

    [Fact]
    public async Task BulkRecategorize_ExpensesIntoBudgetedCategory_AlertsNewCategory()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var shopping = categories["shopping"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var a = await AddAsync(client, TransactionType.Expense, 50m, account, shopping);
        var b = await AddAsync(client, TransactionType.Expense, 40m, account, shopping);
        var september = await AddAsync(client, TransactionType.Expense, 500m, account, shopping, new DateOnly(2026, 9, 1));

        var response = await BulkAsync(client, BulkTransactionAction.Recategorize, [a.Id, b.Id, september.Id], groceries);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Warning,
            Category = new { Id = groceries },
            Percent = 90,
            Amount = 10m,
        });
    }

    [Fact]
    public async Task BulkRecategorize_RefundMovedOut_AlertsOldCategory()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var refund = await AddAsync(client, TransactionType.Income, 40m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 110m, account, groceries);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();

        var response = await BulkAsync(client, BulkTransactionAction.Recategorize, [refund.Id], categories["other_income"]);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Over,
            Category = new { Id = groceries },
            Amount = 10m,
        });
    }

    [Fact]
    public async Task BulkRecategorize_Rejected_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        await client.SetBudgetAsync(groceries, _october, 100m);
        var expense = await AddAsync(client, TransactionType.Expense, 90m, account, categories["shopping"]);

        var response = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id, Guid.NewGuid()], groceries);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task MergeCategory_PushesTargetOverBudget_CreatesOverAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var snacks = await CreateExpenseCategoryAsync(client, "Snacks");
        await client.SetBudgetAsync(groceries, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 50m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 60m, account, snacks);

        var response = await MergeAsync(client, snacks, groceries);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAlertsAsync()).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Level = AlertLevel.Over,
            Category = new { Id = groceries },
            Percent = 110,
            Amount = 10m,
        });
    }

    [Fact]
    public async Task MergeCategory_SummedLimitKeepsTargetBelowThreshold_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var snacks = await CreateExpenseCategoryAsync(client, "Snacks");
        await client.SetBudgetAsync(groceries, _october, 100m);
        await client.SetBudgetAsync(snacks, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 50m, account, groceries);
        await AddAsync(client, TransactionType.Expense, 60m, account, snacks);

        (await MergeAsync(client, snacks, groceries)).StatusCode.Should().Be(HttpStatusCode.OK);

        // 110 of 200 is 55%: the target stays Ok.
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task MergeCategory_TargetWithoutBudget_CreatesNoAlert()
    {
        using var setup = await SetUpAsync();
        var (client, account, categories) = setup;
        var groceries = categories["groceries"];
        var snacks = await CreateExpenseCategoryAsync(client, "Snacks");
        await client.SetBudgetAsync(snacks, _october, 100m);
        await AddAsync(client, TransactionType.Expense, 90m, account, groceries);

        (await MergeAsync(client, snacks, groceries)).StatusCode.Should().Be(HttpStatusCode.OK);

        // Groceries gets a limit through the merge, which is a limit change, not a crossing.
        (await client.GetBudgetsAsync(_october)).Items.Single().Status.Should().Be(BudgetStatus.Warning);
        (await client.GetAlertsAsync()).Items.Should().BeEmpty();
    }

    // User isolation: one user's writes never create or reveal alerts of another.

    [Fact]
    public async Task CreateTransaction_SameCategoryKeyForTwoUsers_AlertsOnlyTheWriter()
    {
        using var setupA = await SetUpAsync();
        using var setupB = await SetUpAsync();
        await setupA.Client.SetBudgetAsync(setupA.Categories["groceries"], _october, 100m);
        await setupB.Client.SetBudgetAsync(setupB.Categories["groceries"], _october, 100m);
        await AddAsync(setupB.Client, TransactionType.Expense, 70m, setupB.AccountId, setupB.Categories["groceries"]);

        await AddAsync(setupA.Client, TransactionType.Expense, 95m, setupA.AccountId, setupA.Categories["groceries"]);

        (await setupA.Client.GetAlertsAsync()).Items.Should().ContainSingle()
            .Which.Category.Id.Should().Be(setupA.Categories["groceries"]);
        var alertsB = await setupB.Client.GetAlertsAsync();
        alertsB.Items.Should().BeEmpty();
        alertsB.UnreadCount.Should().Be(0);
    }

    private async Task<UserSetup> SetUpAsync()
    {
        var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var categories = (await client.GetCategoriesAsync()).ToDictionary(c => c.Key, c => c.Value.Id);
        return new UserSetup(client, account.Id, categories);
    }

    private static Task<TransactionResponse> AddAsync(
        HttpClient client,
        TransactionType type,
        decimal amount,
        Guid accountId,
        Guid categoryId,
        DateOnly? date = null) =>
        client.CreateTransactionAsync(new TransactionRequest(type, amount, date ?? _today, accountId, categoryId, null, null));

    private static async Task UpdateAsync(
        HttpClient client,
        Guid transactionId,
        TransactionType type,
        decimal amount,
        Guid accountId,
        Guid categoryId,
        DateOnly? date = null)
    {
        var response = await client.PutAsJsonAsync(
            $"{TransactionTestExtensions.TransactionsUrl}/{transactionId}",
            new TransactionRequest(type, amount, date ?? _today, accountId, categoryId, null, null),
            ApiJson.Options,
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private static Task<HttpResponseMessage> BulkAsync(
        HttpClient client,
        BulkTransactionAction action,
        IReadOnlyList<Guid> ids,
        Guid? categoryId) =>
        client.PostAsJsonAsync(
            $"{TransactionTestExtensions.TransactionsUrl}/bulk",
            new BulkTransactionRequest(action, ids, categoryId),
            ApiJson.Options,
            CancellationToken);

    private static Task<HttpResponseMessage> MergeAsync(HttpClient client, Guid sourceId, Guid targetId) =>
        client.PostAsJsonAsync(
            $"/api/categories/{sourceId}/merge",
            new MergeCategoryRequest(targetId),
            ApiJson.Options,
            CancellationToken);

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
        return (await response.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken))!.Id;
    }

    /// <summary>A signed-in user with one card account and their categories (by system key or name).</summary>
    private sealed record UserSetup(HttpClient Client, Guid AccountId, IReadOnlyDictionary<string, Guid> Categories)
        : IDisposable
    {
        public void Dispose() => Client.Dispose();
    }
}
