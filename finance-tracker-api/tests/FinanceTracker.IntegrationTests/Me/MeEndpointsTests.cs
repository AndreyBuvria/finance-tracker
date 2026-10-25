using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceTracker.Application.Me;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Me;

public sealed class MeEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task GetMe_Authenticated_ReturnsProfileInAgreedShape()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync(displayName: "Kasia Nowak");
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        var response = await client.GetAsync("/api/me", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CancellationToken));
        json.RootElement.EnumerateObject().Select(p => p.Name).Should()
            .BeEquivalentTo(["id", "email", "displayName", "onboardingCompletedAt"]);
        json.RootElement.GetProperty("id").GetGuid().Should().NotBeEmpty();
        json.RootElement.GetProperty("email").GetString().Should().Be(user.Email);
        json.RootElement.GetProperty("displayName").GetString().Should().Be("Kasia Nowak");
        json.RootElement.GetProperty("onboardingCompletedAt").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task GetMe_WithoutAccessToken_ReturnsUnauthorizedProblem()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/me", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task GetMe_ExpiredAccessToken_ReturnsUnauthorized()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        factory.Time.Advance(TimeSpan.FromMinutes(16));
        var response = await client.GetAsync("/api/me", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_UserDeletedAfterTokenWasIssued_ReturnsUnauthorized()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Users.Where(u => u.Email == user.Email).ExecuteDeleteAsync(CancellationToken);
        }

        var response = await client.GetAsync("/api/me", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("Your session has expired. Log in again.");
    }

    [Fact]
    public async Task GetMe_TwoUsers_EachSeesOnlyOwnProfile()
    {
        using var anonymous = factory.CreateClient();
        var userA = await anonymous.RegisterUserAsync(displayName: "User A");
        var userB = await anonymous.RegisterUserAsync(displayName: "User B");
        using var clientA = factory.CreateClientWithToken(userA.Tokens.AccessToken);
        using var clientB = factory.CreateClientWithToken(userB.Tokens.AccessToken);

        var meA = await clientA.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken);
        var meB = await clientB.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken);

        meA!.Email.Should().Be(userA.Email);
        meA.DisplayName.Should().Be("User A");
        meB!.Email.Should().Be(userB.Email);
        meB.Id.Should().NotBe(meA.Id);
    }

    [Fact]
    public async Task CompleteOnboarding_FirstAndRepeatedCalls_KeepsFirstCompletionTime()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);
        await client.CreateAccountAsync();
        var completedAt = factory.Time.GetUtcNow();

        var first = await client.PostAsync("/api/me/onboarding/complete", null, CancellationToken);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var second = await client.PostAsync("/api/me/onboarding/complete", null, CancellationToken);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var me = await client.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken);
        me!.OnboardingCompletedAt.Should().Be(completedAt);
    }

    [Fact]
    public async Task CompleteOnboarding_UserA_DoesNotChangeUserB()
    {
        using var anonymous = factory.CreateClient();
        var userA = await anonymous.RegisterUserAsync();
        var userB = await anonymous.RegisterUserAsync();
        using var clientA = factory.CreateClientWithToken(userA.Tokens.AccessToken);
        using var clientB = factory.CreateClientWithToken(userB.Tokens.AccessToken);
        await clientA.CreateAccountAsync();

        (await clientA.PostAsync("/api/me/onboarding/complete", null, CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var meB = await clientB.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken);
        meB!.OnboardingCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task CompleteOnboarding_NoActiveAccount_ReturnsConflictAndStaysIncomplete()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        var response = await client.PostAsync("/api/me/onboarding/complete", null, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("Add at least one account first.");
        var me = await client.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken);
        me!.OnboardingCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task CompleteOnboarding_OtherUserHasAccount_ReturnsConflict()
    {
        using var anonymous = factory.CreateClient();
        var userA = await anonymous.RegisterUserAsync();
        var userB = await anonymous.RegisterUserAsync();
        using var clientA = factory.CreateClientWithToken(userA.Tokens.AccessToken);
        using var clientB = factory.CreateClientWithToken(userB.Tokens.AccessToken);
        await clientB.CreateAccountAsync();

        var response = await clientA.PostAsync("/api/me/onboarding/complete", null, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CompleteOnboarding_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/api/me/onboarding/complete", null, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Status.Should().Be(401);
    }
}
