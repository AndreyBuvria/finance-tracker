using System.Net;
using System.Net.Http.Json;

namespace FinanceTracker.IntegrationTests.Infrastructure;

public static class AccountTestExtensions
{
    /// <summary>Creates an active card account for the signed-in user (e.g. so onboarding can complete).</summary>
    public static async Task CreateAccountAsync(this HttpClient client, string name = "Main card")
    {
        var response = await client.PostAsJsonAsync(
            "/api/accounts",
            new { name, type = "Card" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }
}
