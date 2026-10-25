using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Application.Categories;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Budgets;

public sealed class BudgetsEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _budgetsUrl = "/api/budgets";

    private static readonly DateOnly _october = new(2026, 10, 1);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Set_NewLimit_ReturnsBudgetAndStoresFirstDayOfMonth()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 1500.50}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var budget = await response.Content.ReadFromJsonAsync<BudgetResponse>(ApiJson.Options, CancellationToken);
        budget.Should().Be(new BudgetResponse(groceries.Id, "2026-10", 1500.50m));
        (await ListStoredAsync(userId)).Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { CategoryId = groceries.Id, Month = _october, LimitAmount = 1500.50m });
    }

    [Fact]
    public async Task Set_ExistingLimit_ReplacesIt()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];
        await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 1500}");

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 900}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<BudgetResponse>(ApiJson.Options, CancellationToken))!
            .LimitAmount.Should().Be(900m);
        (await ListStoredAsync(userId)).Should().ContainSingle().Which.LimitAmount.Should().Be(900m);
    }

    [Fact]
    public async Task Set_PastAndFutureMonths_KeepsOneBudgetPerMonth()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var past = await PutAsync(client, groceries.Id, "?month=2020-01", "{\"limitAmount\": 100}");
        var current = await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 200}");
        var future = await PutAsync(client, groceries.Id, "?month=2027-12", "{\"limitAmount\": 300}");

        past.StatusCode.Should().Be(HttpStatusCode.OK);
        current.StatusCode.Should().Be(HttpStatusCode.OK);
        future.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ListStoredAsync(userId)).Select(b => (b.Month, b.LimitAmount)).Should().BeEquivalentTo(
        [
            (new DateOnly(2020, 1, 1), 100m),
            (_october, 200m),
            (new DateOnly(2027, 12, 1), 300m),
        ]);
    }

    [Theory]
    [InlineData("{\"limitAmount\": 0}")]
    [InlineData("{\"limitAmount\": 0.00}")]
    [InlineData("{\"limitAmount\": null}")]
    [InlineData("{}")]
    public async Task Set_ZeroOrNullLimit_RemovesBudgetAndReturnsNoContent(string body)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];
        await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 500}");
        await PutAsync(client, groceries.Id, "?month=2026-11", "{\"limitAmount\": 600}");

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", body);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await response.Content.ReadAsStringAsync(CancellationToken)).Should().BeEmpty();
        (await ListStoredAsync(userId)).Should().ContainSingle().Which.Month.Should().Be(new DateOnly(2026, 11, 1));
    }

    [Fact]
    public async Task Set_ZeroLimitWithoutBudget_ReturnsNoContent()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 0}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ListStoredAsync(userId)).Should().BeEmpty();
    }

    [Theory]
    [InlineData("{\"limitAmount\": 100}")]
    [InlineData("{\"limitAmount\": 0}")]
    public async Task Set_IncomeCategory_ReturnsCategoryFieldError(string body)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var salary = (await client.GetCategoriesAsync())["salary"];

        var response = await PutAsync(client, salary.Id, "?month=2026-10", body);

        await AssertFieldErrorAsync(response, "categoryId", "Budgets can only be set for expense categories.");
        (await ListStoredAsync(userId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Set_HiddenCategory_ReturnsCategoryFieldErrorButRemovingSucceeds()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var health = (await client.GetCategoriesAsync())["health"];
        await PutAsync(client, health.Id, "?month=2026-10", "{\"limitAmount\": 300}");
        (await client.PostAsync($"/api/categories/{health.Id}/archive", null, CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var set = await PutAsync(client, health.Id, "?month=2026-10", "{\"limitAmount\": 400}");
        await AssertFieldErrorAsync(set, "categoryId", "This category is hidden. Choose an active category.");
        (await ListStoredAsync(userId)).Should().ContainSingle().Which.LimitAmount.Should().Be(300m);

        var remove = await PutAsync(client, health.Id, "?month=2026-10", "{\"limitAmount\": 0}");
        remove.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ListStoredAsync(userId)).Should().BeEmpty();
    }

    [Theory]
    [InlineData("{\"limitAmount\": -1}", "Enter an amount of 0 or more.")]
    [InlineData("{\"limitAmount\": 10.123}", "Enter an amount with at most 2 decimal places.")]
    [InlineData("{\"limitAmount\": 10000000000000000}", "Enter a smaller amount.")]
    public async Task Set_InvalidLimit_ReturnsLimitFieldError(string body, string expectedMessage)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", body);

        await AssertFieldErrorAsync(response, "limitAmount", expectedMessage);
    }

    [Fact]
    public async Task Set_MaxAmountLimit_Succeeds()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, "?month=2026-10", "{\"limitAmount\": 9999999999999999.99}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("", "Choose a month.")]
    [InlineData("?month=", "Choose a month.")]
    [InlineData("?month=%20", "Choose a month.")]
    [InlineData("?month=2026-13", "Enter a month as YYYY-MM.")]
    [InlineData("?month=2026-00", "Enter a month as YYYY-MM.")]
    [InlineData("?month=2026-1", "Enter a month as YYYY-MM.")]
    [InlineData("?month=10-2026", "Enter a month as YYYY-MM.")]
    [InlineData("?month=2026-10-01", "Enter a month as YYYY-MM.")]
    [InlineData("?month=2026/10", "Enter a month as YYYY-MM.")]
    [InlineData("?month=0000-10", "Enter a month as YYYY-MM.")]
    [InlineData("?month=october", "Enter a month as YYYY-MM.")]
    public async Task Set_MissingOrUnreadableMonth_ReturnsMonthFieldError(string query, string expectedMessage)
    {
        using var client = await factory.CreateSignedInClientAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, query, "{\"limitAmount\": 100}");

        await AssertFieldErrorAsync(response, "month", expectedMessage);
    }

    [Fact]
    public async Task Set_InvalidMonthAndLimit_ReturnsBothFieldErrors()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"];

        var response = await PutAsync(client, groceries.Id, "?month=x", "{\"limitAmount\": -5}");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Keys.Should().BeEquivalentTo("month", "limitAmount");
    }

    [Fact]
    public async Task Set_UnknownCategory_ReturnsNotFound()
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await PutAsync(client, Guid.NewGuid(), "?month=2026-10", "{\"limitAmount\": 100}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category doesn't exist.");
    }

    [Fact]
    public async Task Set_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await PutAsync(client, Guid.NewGuid(), "?month=2026-10", "{\"limitAmount\": 100}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Set_AfterMerge_TargetBudgetCanBeReplacedAndSourceIsHidden()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var categories = await client.GetCategoriesAsync();
        var shopping = categories["shopping"];
        var entertainment = categories["entertainment"];
        await PutAsync(client, shopping.Id, "?month=2026-10", "{\"limitAmount\": 100}");
        await PutAsync(client, entertainment.Id, "?month=2026-10", "{\"limitAmount\": 50}");

        (await client.PostAsJsonAsync(
            $"/api/categories/{shopping.Id}/merge",
            new MergeCategoryRequest(entertainment.Id),
            ApiJson.Options,
            CancellationToken)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await ListStoredAsync(userId)).Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { CategoryId = entertainment.Id, LimitAmount = 150m });
        var intoSource = await PutAsync(client, shopping.Id, "?month=2026-10", "{\"limitAmount\": 10}");
        await AssertFieldErrorAsync(intoSource, "categoryId", "This category is hidden. Choose an active category.");
    }

    // User isolation: another user's category behaves as if it doesn't exist.

    [Theory]
    [InlineData("{\"limitAmount\": 999}")]
    [InlineData("{\"limitAmount\": 0}")]
    [InlineData("{\"limitAmount\": null}")]
    public async Task Set_OtherUsersCategory_ReturnsNotFoundAndLeavesTheirBudget(string body)
    {
        using var clientA = await factory.CreateSignedInClientAsync();
        using var clientB = await factory.CreateSignedInClientAsync();
        var userA = await clientA.GetUserIdAsync();
        var userB = await clientB.GetUserIdAsync();
        var groceriesB = (await clientB.GetCategoriesAsync())["groceries"];
        await PutAsync(clientB, groceriesB.Id, "?month=2026-10", "{\"limitAmount\": 500}");

        var response = await PutAsync(clientA, groceriesB.Id, "?month=2026-10", body);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListStoredAsync(userB)).Should().ContainSingle().Which.LimitAmount.Should().Be(500m);
        (await ListStoredAsync(userA)).Should().BeEmpty();
    }

    [Fact]
    public async Task Set_SameCategoryKeyForTwoUsers_EachKeepsOwnBudget()
    {
        using var clientA = await factory.CreateSignedInClientAsync();
        using var clientB = await factory.CreateSignedInClientAsync();
        var userA = await clientA.GetUserIdAsync();
        var userB = await clientB.GetUserIdAsync();
        var groceriesA = (await clientA.GetCategoriesAsync())["groceries"];
        var groceriesB = (await clientB.GetCategoriesAsync())["groceries"];
        await PutAsync(clientB, groceriesB.Id, "?month=2026-10", "{\"limitAmount\": 500}");

        await PutAsync(clientA, groceriesA.Id, "?month=2026-10", "{\"limitAmount\": 100}");
        await PutAsync(clientA, groceriesA.Id, "?month=2026-10", "{\"limitAmount\": 0}");

        (await ListStoredAsync(userA)).Should().BeEmpty();
        (await ListStoredAsync(userB)).Should().ContainSingle().Which.LimitAmount.Should().Be(500m);
        (await clientA.GetCategoriesAsync())["groceries"].BudgetCount.Should().Be(0);
        (await clientB.GetCategoriesAsync())["groceries"].BudgetCount.Should().Be(1);
    }

    private static Task<HttpResponseMessage> PutAsync(HttpClient client, Guid categoryId, string query, string body) =>
        client.PutAsync(
            $"{_budgetsUrl}/{categoryId}{query}",
            new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
            CancellationToken);

    private async Task<IReadOnlyList<Budget>> ListStoredAsync(Guid userId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Budgets.AsNoTracking()
            .Where(b => b.UserId == userId)
            .OrderBy(b => b.Month)
            .ToListAsync(CancellationToken);
    }

    private static async Task AssertFieldErrorAsync(HttpResponseMessage response, string field, string expectedMessage)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }
}
