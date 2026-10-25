using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Dates;

/// <summary>
/// "Today" is the Europe/Warsaw calendar date (PLAN.md §6 Dates). The clock here is 21 Oct 22:30 UTC, which is
/// already 22 Oct in Warsaw, so a UTC-based "today" would give different answers.
/// </summary>
public sealed class WarsawTodayTests(WarsawAfterMidnightApiFactory factory)
    : IClassFixture<WarsawAfterMidnightApiFactory>
{
    private static readonly DateOnly _warsawToday = WarsawAfterMidnightApiFactory.WarsawToday;

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task CreateTransaction_TomorrowInWarsaw_IsAllowedAndTheDayAfterIsRejected()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var groceries = (await client.GetCategoriesAsync())["groceries"].Id;

        // 23 Oct is "tomorrow" in Warsaw but two days ahead of the UTC date.
        var tomorrow = await client.PostTransactionAsync(new TransactionRequest(
            TransactionType.Expense, 5m, _warsawToday.AddDays(1), account.Id, groceries, null, null));
        var dayAfter = await client.PostTransactionAsync(new TransactionRequest(
            TransactionType.Expense, 5m, _warsawToday.AddDays(2), account.Id, groceries, null, null));
        var transferDayAfter = await client.PostTransferAsync(new TransferRequest(
            account.Id, (await client.CreateAccountResponseAsync("Savings")).Id, 5m, _warsawToday.AddDays(2), null));

        tomorrow.StatusCode.Should().Be(HttpStatusCode.Created);
        foreach (var response in new[] { dayAfter, transferDayAfter })
        {
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
            problem!.Errors.Should().ContainKey("date").WhoseValue.Should().Equal("Date can't be in the future.");
        }
    }

    [Fact]
    public async Task ListTopCategories_UseOnFirstDayOfUtcWindow_FallsOutsideWarsawWindow()
    {
        using var client = await factory.CreateSignedInClientAsync();
        var userId = await client.GetUserIdAsync();
        var account = await client.CreateAccountResponseAsync("Main card");
        var categories = await client.GetCategoriesAsync();

        // The 90-day window ending on 22 Oct (Warsaw) starts on 25 Jul; with the UTC date (21 Oct) it would start on
        // 24 Jul. Uses on 24 Jul must therefore not count, uses on 25 Jul must.
        var lastDayOutside = _warsawToday.AddDays(-90);
        var firstDayInside = _warsawToday.AddDays(-89);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Transactions.AddRange(Enumerable.Range(0, 3)
                .Select(_ => Expense(userId, account.Id, categories["health"].Id, lastDayOutside)));
            db.Transactions.Add(Expense(userId, account.Id, categories["shopping"].Id, firstDayInside));
            await db.SaveChangesAsync(CancellationToken);
        }

        var top = await client.GetFromJsonAsync<CategoryListResponse>(
            "/api/categories/top?limit=2&type=Expense",
            ApiJson.Options,
            CancellationToken);

        top!.Items.Select(c => c.SystemKey).Should().Equal("shopping", "groceries");
    }

    private static Transaction Expense(Guid userId, Guid accountId, Guid categoryId, DateOnly date) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = accountId,
            CategoryId = categoryId,
            Type = TransactionType.Expense,
            Amount = 5m,
            Date = date,
            Source = TransactionSource.Manual,
        };
}
