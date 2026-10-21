using System.Net;
using FinanceTracker.IntegrationTests.Infrastructure;

namespace FinanceTracker.IntegrationTests.Health;

public sealed class HealthEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task GetHealth_DatabaseAvailable_ReturnsOk()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Be("Healthy");
    }
}
