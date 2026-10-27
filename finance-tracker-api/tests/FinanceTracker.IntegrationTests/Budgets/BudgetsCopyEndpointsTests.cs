using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Budgets;

/// <summary><c>POST /budgets/copy?from=YYYY-MM&amp;to=YYYY-MM</c> (PLAN.md §6 Budgets, §7 Budgets contract Phase 2).</summary>
public sealed class BudgetsCopyEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly DateOnly _september = new(2026, 9, 1);
    private static readonly DateOnly _october = new(2026, 10, 1);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Copy_FromPreviousMonth_CopiesOnlyCategoriesWithoutLimit()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var categories = await client.GetCategoriesAsync();
        var groceries = categories["groceries"].Id;
        var transport = categories["transport"].Id;
        var eatingOut = categories["eating_out"].Id;
        await client.SetBudgetAsync(groceries, "2026-09", 500m);
        await client.SetBudgetAsync(transport, "2026-09", 200m);
        await client.SetBudgetAsync(eatingOut, "2026-09", 300.50m);
        await client.SetBudgetAsync(groceries, "2026-10", 900m);

        var response = await client.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertCopiedAsync(response, 2);
        (await ListStoredAsync(userId, _october)).Select(b => (b.CategoryId, b.LimitAmount)).Should().BeEquivalentTo(
        [
            (groceries, 900m),
            (transport, 200m),
            (eatingOut, 300.50m),
        ]);
        (await ListStoredAsync(userId, _september)).Should().HaveCount(3);
    }

    [Fact]
    public async Task Copy_HiddenCategory_IsSkipped()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var categories = await client.GetCategoriesAsync();
        var groceries = categories["groceries"].Id;
        var health = categories["health"].Id;
        await client.SetBudgetAsync(groceries, "2026-09", 500m);
        await client.SetBudgetAsync(health, "2026-09", 100m);
        (await client.PostAsync($"/api/categories/{health}/archive", null, CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var response = await client.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertCopiedAsync(response, 1);
        (await ListStoredAsync(userId, _october)).Should().ContainSingle().Which.CategoryId.Should().Be(groceries);
    }

    [Fact]
    public async Task Copy_EmptySourceMonth_ReturnsConflict()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        await client.SetBudgetAsync((await client.GetCategoriesAsync())["groceries"].Id, "2026-10", 100m);

        var response = await client.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertNothingToCopyAsync(response);
        (await ListStoredAsync(userId, _october)).Should().ContainSingle().Which.LimitAmount.Should().Be(100m);
    }

    [Fact]
    public async Task Copy_AllLimitsAlreadySetOrHidden_ReturnsConflict()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var categories = await client.GetCategoriesAsync();
        var groceries = categories["groceries"].Id;
        var health = categories["health"].Id;
        await client.SetBudgetAsync(groceries, "2026-09", 500m);
        await client.SetBudgetAsync(health, "2026-09", 100m);
        await client.SetBudgetAsync(groceries, "2026-10", 700m);
        (await client.PostAsync($"/api/categories/{health}/archive", null, CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var response = await client.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertNothingToCopyAsync(response);
        (await ListStoredAsync(userId, _october)).Should().ContainSingle().Which.LimitAmount.Should().Be(700m);
    }

    [Fact]
    public async Task Copy_AcrossYearBoundary_StoresFirstDayOfTargetMonth()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;
        await client.SetBudgetAsync(groceries, "2026-12", 650m);

        var response = await client.CopyBudgetsAsync("?from=2026-12&to=2027-01");

        await AssertCopiedAsync(response, 1);
        (await ListStoredAsync(userId, new DateOnly(2027, 1, 1))).Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { CategoryId = groceries, LimitAmount = 650m });
        var january = await client.GetBudgetsAsync("2027-01");
        january.Items.Should().ContainSingle().Which.LimitAmount.Should().Be(650m);
    }

    [Fact]
    public async Task Copy_IntoEarlierMonth_IsAllowed()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        await client.SetBudgetAsync((await client.GetCategoriesAsync())["groceries"].Id, "2026-10", 400m);

        var response = await client.CopyBudgetsAsync("?from=2026-10&to=2026-09");

        await AssertCopiedAsync(response, 1);
        (await ListStoredAsync(userId, _september)).Should().ContainSingle().Which.LimitAmount.Should().Be(400m);
    }

    [Fact]
    public async Task Copy_SameMonth_ReturnsToFieldError()
    {
        using var client = await factory.CreateSignedInClientAsync();
        await client.SetBudgetAsync((await client.GetCategoriesAsync())["groceries"].Id, "2026-10", 400m);

        var response = await client.CopyBudgetsAsync("?from=2026-10&to=%202026-10");

        await AssertFieldErrorAsync(response, "to", "Choose a different month to copy to.");
    }

    [Theory]
    [InlineData("?to=2026-10", "from", "Choose a month.")]
    [InlineData("?from=2026-09", "to", "Choose a month.")]
    [InlineData("?from=2026-9&to=2026-10", "from", "Enter a month as YYYY-MM.")]
    [InlineData("?from=2026-09&to=2026-13", "to", "Enter a month as YYYY-MM.")]
    [InlineData("?from=x&to=x", "to", "Enter a month as YYYY-MM.")]
    public async Task Copy_MissingOrUnreadableMonth_ReturnsFieldError(string query, string field, string expectedMessage)
    {
        using var client = await factory.CreateSignedInClientAsync();

        var response = await client.CopyBudgetsAsync(query);

        await AssertFieldErrorAsync(response, field, expectedMessage);
    }

    [Fact]
    public async Task Copy_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // User isolation: only the caller's own budgets are read and written.

    [Fact]
    public async Task Copy_OtherUsersBudgets_AreNeitherCopiedNorChanged()
    {
        using var clientA = await factory.CreateSignedInClientAsync();
        using var clientB = await factory.CreateSignedInClientAsync();
        var userA = await clientA.GetUserIdAsync();
        var userB = await clientB.GetUserIdAsync();
        var groceriesB = (await clientB.GetCategoriesAsync())["groceries"].Id;
        await clientB.SetBudgetAsync(groceriesB, "2026-09", 500m);

        var response = await clientA.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertNothingToCopyAsync(response);
        (await ListStoredAsync(userA, _october)).Should().BeEmpty();
        (await ListStoredAsync(userB, _october)).Should().BeEmpty();
        (await ListStoredAsync(userB, _september)).Should().ContainSingle().Which.LimitAmount.Should().Be(500m);
    }

    [Fact]
    public async Task Copy_TwoUsersSameMonths_EachCopiesOnlyOwnBudgets()
    {
        using var clientA = await factory.CreateSignedInClientAsync();
        using var clientB = await factory.CreateSignedInClientAsync();
        var userA = await clientA.GetUserIdAsync();
        var userB = await clientB.GetUserIdAsync();
        var groceriesA = (await clientA.GetCategoriesAsync())["groceries"].Id;
        var categoriesB = await clientB.GetCategoriesAsync();
        await clientA.SetBudgetAsync(groceriesA, "2026-09", 100m);
        await clientB.SetBudgetAsync(categoriesB["groceries"].Id, "2026-09", 200m);
        await clientB.SetBudgetAsync(categoriesB["transport"].Id, "2026-09", 300m);

        var response = await clientA.CopyBudgetsAsync("?from=2026-09&to=2026-10");

        await AssertCopiedAsync(response, 1);
        (await ListStoredAsync(userA, _october)).Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { CategoryId = groceriesA, LimitAmount = 100m });
        (await ListStoredAsync(userB, _october)).Should().BeEmpty();
    }

    private static async Task AssertCopiedAsync(HttpResponseMessage response, int expected)
    {
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<CopyBudgetsResponse>(ApiJson.Options, CancellationToken))
            .Should().Be(new CopyBudgetsResponse(expected));
    }

    private static async Task AssertNothingToCopyAsync(HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Status.Should().Be(StatusCodes.Status409Conflict);
        problem.Title.Should().Be("Nothing to copy");
        problem.Detail.Should().Be("There are no budgets to copy from that month.");
    }

    private static async Task AssertFieldErrorAsync(HttpResponseMessage response, string field, string expectedMessage)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }

    private async Task<IReadOnlyList<Budget>> ListStoredAsync(Guid userId, DateOnly month)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Budgets.AsNoTracking()
            .Where(b => b.UserId == userId && b.Month == month)
            .ToListAsync(CancellationToken);
    }
}
