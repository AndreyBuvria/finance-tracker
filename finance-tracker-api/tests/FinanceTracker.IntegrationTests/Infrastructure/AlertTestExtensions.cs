using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Alerts;

namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>HTTP helpers for tests that work with budget alerts.</summary>
public static class AlertTestExtensions
{
    public const string AlertsUrl = "/api/alerts";

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    public static Task<HttpResponseMessage> GetAlertsResponseAsync(this HttpClient client, string query = "") =>
        client.GetAsync($"{AlertsUrl}{query}", CancellationToken);

    /// <summary>The user's alerts (newest first) with the unread count; expects 200.</summary>
    public static async Task<AlertListResponse> GetAlertsAsync(this HttpClient client, string query = "")
    {
        var response = await client.GetAlertsResponseAsync(query);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<AlertListResponse>(ApiJson.Options, CancellationToken))!;
    }

    public static Task<HttpResponseMessage> MarkAlertReadAsync(this HttpClient client, Guid alertId) =>
        client.PostAsync($"{AlertsUrl}/{alertId}/read", null, CancellationToken);

    public static Task<HttpResponseMessage> MarkAllAlertsReadAsync(this HttpClient client) =>
        client.PostAsync($"{AlertsUrl}/read-all", null, CancellationToken);
}
