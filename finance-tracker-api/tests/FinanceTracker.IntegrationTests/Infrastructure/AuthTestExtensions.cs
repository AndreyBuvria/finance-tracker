using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FinanceTracker.Application.Auth;

namespace FinanceTracker.IntegrationTests.Infrastructure;

public sealed record RegisteredUser(string Email, string Password, AuthTokens Tokens);

public static class AuthTestExtensions
{
    public const string DefaultPassword = "Secret123";

    /// <summary>A unique email per call so tests sharing a database never collide.</summary>
    public static string UniqueEmail() => $"user-{Guid.NewGuid():N}@example.com";

    public static async Task<RegisteredUser> RegisterUserAsync(
        this HttpClient client,
        string? email = null,
        string displayName = "Kasia")
    {
        email ??= UniqueEmail();
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest(displayName, email, DefaultPassword),
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tokens = await response.Content.ReadFromJsonAsync<AuthTokens>(TestContext.Current.CancellationToken);
        return new RegisteredUser(email, DefaultPassword, tokens!);
    }

    public static Task<HttpResponseMessage> RefreshAsync(this HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshRequest(refreshToken),
            TestContext.Current.CancellationToken);

    /// <summary>A client that sends the given access token as a bearer token.</summary>
    public static HttpClient CreateClientWithToken(this ApiFactory factory, string accessToken)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }
}
