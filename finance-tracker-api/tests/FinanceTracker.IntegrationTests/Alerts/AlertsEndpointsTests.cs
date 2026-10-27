using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.IntegrationTests.Alerts;

/// <summary>
/// <c>GET /alerts</c>, <c>POST /alerts/{id}/read</c> and <c>POST /alerts/read-all</c> (PLAN.md §7 Alerts contract).
/// The clock starts at 21 Oct 2026 12:00 in Warsaw; tests advance it by minutes only, so the date stays the same.
/// </summary>
public sealed class AlertsEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _october = "2026-10";

    private static readonly DateOnly _today = new(2026, 10, 21);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task List_NoAlerts_ReturnsEmptyItemsAndZeroUnread()
    {
        using var client = await factory.CreateSignedInClientAsync();

        var alerts = await client.GetAlertsAsync();

        alerts.Items.Should().BeEmpty();
        alerts.UnreadCount.Should().Be(0);
    }

    [Fact]
    public async Task List_ResponseShape_MatchesContract()
    {
        using var setup = await SetUpAsync();
        await setup.Client.SetBudgetAsync(setup.Groceries, _october, 100m);
        await AddExpenseAsync(setup, setup.Groceries, 92m);

        var json = await setup.Client.GetStringAsync(AlertTestExtensions.AlertsUrl, CancellationToken);

        json.Should().Contain("\"items\":[{\"id\":")
            .And.Contain("\"level\":\"Warning\"")
            .And.Contain("\"month\":\"2026-10\"")
            .And.Contain($"\"category\":{{\"id\":\"{setup.Groceries}\",\"name\":\"Groceries\",\"icon\":\"shopping_cart\",\"color\":\"#2e7d32\"}}")
            .And.Contain("\"percent\":92")
            .And.Contain("\"amount\":8")
            .And.Contain("\"daysLeft\":11")
            .And.Contain("\"createdAt\":")
            .And.Contain("\"readAt\":null")
            .And.Contain("\"unreadCount\":1");
    }

    [Fact]
    public async Task List_Limit_ReturnsNewestFirstAndCountsAllUnread()
    {
        using var setup = await SetUpAsync();
        var (groceriesWarning, groceriesOver, eatingOutWarning) = await CreateThreeAlertsAsync(setup);

        var all = await setup.Client.GetAlertsAsync();
        var limited = await setup.Client.GetAlertsAsync("?limit=2");

        all.Items.Select(a => a.Id).Should().Equal(eatingOutWarning, groceriesOver, groceriesWarning);
        limited.Items.Select(a => a.Id).Should().Equal(eatingOutWarning, groceriesOver);
        limited.UnreadCount.Should().Be(3);
    }

    [Theory]
    [InlineData("?limit=0")]
    [InlineData("?limit=51")]
    [InlineData("?limit=-1")]
    public async Task List_LimitOutOfRange_ReturnsValidationProblem(string query)
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await client.GetAlertsResponseAsync(query);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("limit").WhoseValue.Should().Equal("Limit must be between 1 and 50.");
    }

    [Theory]
    [InlineData("?limit=1", 1)]
    [InlineData("?limit=50", 3)]
    public async Task List_LimitAtBounds_IsAccepted(string query, int expectedCount)
    {
        using var setup = await SetUpAsync();
        await CreateThreeAlertsAsync(setup);

        var alerts = await setup.Client.GetAlertsAsync(query);

        alerts.Items.Should().HaveCount(expectedCount);
    }

    [Fact]
    public async Task List_UnreadOnly_LeavesOutReadAlerts()
    {
        using var setup = await SetUpAsync();
        var (groceriesWarning, groceriesOver, eatingOutWarning) = await CreateThreeAlertsAsync(setup);
        (await setup.Client.MarkAlertReadAsync(groceriesOver)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var unread = await setup.Client.GetAlertsAsync("?unreadOnly=true");
        var all = await setup.Client.GetAlertsAsync("?unreadOnly=false");

        unread.Items.Select(a => a.Id).Should().Equal(eatingOutWarning, groceriesWarning);
        unread.UnreadCount.Should().Be(2);
        all.Items.Should().HaveCount(3);
        all.Items.Single(a => a.Id == groceriesOver).ReadAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkRead_Twice_KeepsFirstReadTime()
    {
        using var setup = await SetUpAsync();
        await setup.Client.SetBudgetAsync(setup.Groceries, _october, 100m);
        await AddExpenseAsync(setup, setup.Groceries, 85m);
        var alertId = (await setup.Client.GetAlertsAsync()).Items.Single().Id;

        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var firstReadAt = factory.Time.GetUtcNow();
        var first = await setup.Client.MarkAlertReadAsync(alertId);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var second = await setup.Client.MarkAlertReadAsync(alertId);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var alerts = await setup.Client.GetAlertsAsync();
        alerts.Items.Single().ReadAt.Should().Be(firstReadAt);
        alerts.UnreadCount.Should().Be(0);
    }

    [Fact]
    public async Task MarkRead_UnknownAlert_ReturnsNotFound()
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await client.MarkAlertReadAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This alert doesn't exist.");
    }

    [Fact]
    public async Task MarkAllRead_MarksUnreadAndKeepsEarlierReadTimes()
    {
        using var setup = await SetUpAsync();
        var (groceriesWarning, _, _) = await CreateThreeAlertsAsync(setup);
        var earlierReadAt = factory.Time.GetUtcNow();
        await setup.Client.MarkAlertReadAsync(groceriesWarning);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var laterReadAt = factory.Time.GetUtcNow();

        var response = await setup.Client.MarkAllAlertsReadAsync();

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var alerts = await setup.Client.GetAlertsAsync();
        alerts.UnreadCount.Should().Be(0);
        alerts.Items.Single(a => a.Id == groceriesWarning).ReadAt.Should().Be(earlierReadAt);
        alerts.Items.Where(a => a.Id != groceriesWarning).Should().OnlyContain(a => a.ReadAt == laterReadAt);
        (await setup.Client.GetAlertsAsync("?unreadOnly=true")).Items.Should().BeEmpty();
    }

    [Fact]
    public async Task MarkAllRead_NoAlerts_ReturnsNoContent()
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await client.MarkAllAlertsReadAsync();

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Endpoints_WithoutAccessToken_ReturnUnauthorized()
    {
        using var client = factory.CreateClient();

        var list = await client.GetAlertsResponseAsync();
        var read = await client.MarkAlertReadAsync(Guid.NewGuid());
        var readAll = await client.MarkAllAlertsReadAsync();

        list.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        read.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        readAll.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // User isolation: user A can neither see nor change user B's alerts.

    [Fact]
    public async Task List_OtherUsersAlerts_AreNotVisible()
    {
        using var setupB = await SetUpAsync();
        await CreateThreeAlertsAsync(setupB);
        using var clientA = await factory.CreateSignedInClientAsync();

        var alertsA = await clientA.GetAlertsAsync();

        alertsA.Items.Should().BeEmpty();
        alertsA.UnreadCount.Should().Be(0);
        (await setupB.Client.GetAlertsAsync()).UnreadCount.Should().Be(3);
    }

    [Fact]
    public async Task MarkRead_OtherUsersAlert_ReturnsNotFoundAndLeavesItUnread()
    {
        using var setupB = await SetUpAsync();
        await setupB.Client.SetBudgetAsync(setupB.Groceries, _october, 100m);
        await AddExpenseAsync(setupB, setupB.Groceries, 85m);
        var alertB = (await setupB.Client.GetAlertsAsync()).Items.Single().Id;
        using var clientA = await factory.CreateSignedInClientAsync();

        var response = await clientA.MarkAlertReadAsync(alertB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var alertsB = await setupB.Client.GetAlertsAsync();
        alertsB.UnreadCount.Should().Be(1);
        alertsB.Items.Single().ReadAt.Should().BeNull();
    }

    [Fact]
    public async Task MarkAllRead_OtherUsersAlerts_StayUnread()
    {
        using var setupB = await SetUpAsync();
        await CreateThreeAlertsAsync(setupB);
        using var setupA = await SetUpAsync();
        await setupA.Client.SetBudgetAsync(setupA.Groceries, _october, 100m);
        await AddExpenseAsync(setupA, setupA.Groceries, 85m);

        (await setupA.Client.MarkAllAlertsReadAsync()).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await setupA.Client.GetAlertsAsync()).UnreadCount.Should().Be(0);
        var alertsB = await setupB.Client.GetAlertsAsync();
        alertsB.UnreadCount.Should().Be(3);
        alertsB.Items.Should().OnlyContain(a => a.ReadAt == null);
    }

    /// <summary>
    /// Groceries Warning, then Groceries Over, then Eating out Warning, a minute apart so their order is defined.
    /// </summary>
    private async Task<(Guid GroceriesWarning, Guid GroceriesOver, Guid EatingOutWarning)> CreateThreeAlertsAsync(
        UserSetup setup)
    {
        await setup.Client.SetBudgetAsync(setup.Groceries, _october, 100m);
        await setup.Client.SetBudgetAsync(setup.EatingOut, _october, 100m);

        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await AddExpenseAsync(setup, setup.Groceries, 85m);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await AddExpenseAsync(setup, setup.Groceries, 20m);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await AddExpenseAsync(setup, setup.EatingOut, 90m);

        var items = (await setup.Client.GetAlertsAsync()).Items;
        items.Should().HaveCount(3);
        return (
            items.Single(a => a.Category.Id == setup.Groceries && a.Level == AlertLevel.Warning).Id,
            items.Single(a => a.Category.Id == setup.Groceries && a.Level == AlertLevel.Over).Id,
            items.Single(a => a.Category.Id == setup.EatingOut).Id);
    }

    private async Task<UserSetup> SetUpAsync()
    {
        var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var categories = await client.GetCategoriesAsync();
        return new UserSetup(client, account.Id, categories["groceries"].Id, categories["eating_out"].Id);
    }

    private static Task<TransactionResponse> AddExpenseAsync(UserSetup setup, Guid categoryId, decimal amount) =>
        setup.Client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Expense, amount, _today, setup.AccountId, categoryId, null, null));

    /// <summary>A signed-in user with one card account and two budgetable categories.</summary>
    private sealed record UserSetup(HttpClient Client, Guid AccountId, Guid Groceries, Guid EatingOut) : IDisposable
    {
        public void Dispose() => Client.Dispose();
    }
}
