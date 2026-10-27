using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Budgets;

namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>HTTP helpers for tests that work with monthly budgets.</summary>
public static class BudgetTestExtensions
{
    public const string BudgetsUrl = "/api/budgets";

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    /// <summary>Sets the limit of a category for a month (<c>YYYY-MM</c>) and expects 200.</summary>
    public static async Task SetBudgetAsync(this HttpClient client, Guid categoryId, string month, decimal limit)
    {
        var response = await client.PutAsJsonAsync(
            $"{BudgetsUrl}/{categoryId}?month={month}",
            new BudgetRequest(limit),
            ApiJson.Options,
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    public static Task<HttpResponseMessage> GetBudgetsResponseAsync(this HttpClient client, string query) =>
        client.GetAsync($"{BudgetsUrl}{query}", CancellationToken);

    /// <summary>The budgets of a month (<c>YYYY-MM</c>); expects 200.</summary>
    public static async Task<BudgetMonthResponse> GetBudgetsAsync(this HttpClient client, string month)
    {
        var response = await client.GetBudgetsResponseAsync($"?month={month}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<BudgetMonthResponse>(ApiJson.Options, CancellationToken))!;
    }

    public static Task<HttpResponseMessage> CopyBudgetsAsync(this HttpClient client, string query) =>
        client.PostAsync($"{BudgetsUrl}/copy{query}", null, CancellationToken);
}
