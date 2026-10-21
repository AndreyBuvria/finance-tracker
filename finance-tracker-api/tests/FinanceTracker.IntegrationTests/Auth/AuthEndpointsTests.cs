using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FinanceTracker.Application.Auth;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Auth;

public sealed class AuthEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_ValidRequest_ReturnsCreatedWithTokens()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", AuthTestExtensions.UniqueEmail(), "Secret123"),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tokens = await response.Content.ReadFromJsonAsync<AuthTokens>(CancellationToken);
        tokens!.AccessToken.Should().NotBeNullOrWhiteSpace();
        tokens.RefreshToken.Should().NotBeNullOrWhiteSpace();
        tokens.ExpiresIn.Should().Be(15 * 60);
    }

    [Fact]
    public async Task Register_DuplicateEmailInDifferentCase_ReturnsConflict()
    {
        using var client = factory.CreateClient();
        var existing = await client.RegisterUserAsync();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Someone else", existing.Email.ToUpperInvariant(), "Another123"),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("An account with this email already exists. Log in instead?");
    }

    [Fact]
    public async Task Register_ConcurrentRequestsWithSameEmail_ExactlyOneSucceeds()
    {
        using var client = factory.CreateClient();
        var email = AuthTestExtensions.UniqueEmail();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            client.PostAsJsonAsync(
                "/api/auth/register",
                new RegisterRequest("Kasia", email, "Secret123"),
                CancellationToken)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).Should().Be(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).Should().Be(4);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var normalizedEmail = email.ToUpperInvariant();
        var userIds = await db.Users.Where(u => u.NormalizedEmail == normalizedEmail).Select(u => u.Id)
            .ToListAsync(CancellationToken);
        userIds.Should().ContainSingle();
        (await db.Categories.CountAsync(c => c.UserId == userIds[0], CancellationToken))
            .Should().Be(DefaultCategories.All.Count);
    }

    [Fact]
    public async Task Register_EmptyFields_ReturnsValidationProblemPerField()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { displayName = " ", email = "", password = "" },
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().BeEquivalentTo(new Dictionary<string, string[]>
        {
            ["displayName"] = ["Enter your name."],
            ["email"] = ["Enter your email."],
            ["password"] = ["Enter your password."],
        });
    }

    [Theory]
    [InlineData("Short1", "Password must be at least 8 characters.")]
    [InlineData("onlyletters", "Password must include at least one letter and one number.")]
    [InlineData("12345678", "Password must include at least one letter and one number.")]
    public async Task Register_WeakPassword_ReturnsPasswordError(string password, string expectedMessage)
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", AuthTestExtensions.UniqueEmail(), password),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("password").WhoseValue.Should().Equal(expectedMessage);
    }

    [Fact]
    public async Task Register_InvalidEmail_ReturnsEmailError()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", "not-an-email", "Secret123"),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("email").WhoseValue.Should().Equal("Enter a valid email address.");
    }

    [Fact]
    public async Task Register_NewUser_SeedsDefaultCategories()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users.Where(u => u.Email == user.Email).Select(u => u.Id).SingleAsync(CancellationToken);
        var categories = await db.Categories
            .Where(c => c.UserId == userId)
            .Select(c => new SeededCategory(c.SystemKey, c.Name, c.Type, c.Icon, c.Color, c.IsArchived))
            .ToListAsync(CancellationToken);

        // PLAN.md §5 "Seeded default categories".
        categories.Should().BeEquivalentTo(new[]
        {
            Seed("groceries", "Groceries", CategoryType.Expense, "shopping_cart", "#2e7d32"),
            Seed("eating_out", "Eating out", CategoryType.Expense, "restaurant", "#ef6c00"),
            Seed("transport", "Transport", CategoryType.Expense, "directions_bus", "#1565c0"),
            Seed("housing", "Housing", CategoryType.Expense, "home", "#6d4c41"),
            Seed("utilities", "Utilities", CategoryType.Expense, "bolt", "#fbc02d"),
            Seed("health", "Health", CategoryType.Expense, "medical_services", "#c62828"),
            Seed("shopping", "Shopping", CategoryType.Expense, "shopping_bag", "#ad1457"),
            Seed("entertainment", "Entertainment", CategoryType.Expense, "movie", "#7b1fa2"),
            Seed("subscriptions", "Subscriptions", CategoryType.Expense, "subscriptions", "#3949ab"),
            Seed("other", "Other", CategoryType.Expense, "category", "#546e7a"),
            Seed("salary", "Salary", CategoryType.Income, "payments", "#00838f"),
            Seed("other_income", "Other income", CategoryType.Income, "savings", "#c0ca33"),
        });

        static SeededCategory Seed(string systemKey, string name, CategoryType type, string icon, string color) =>
            new(systemKey, name, type, icon, color, IsArchived: false);
    }

    [Fact]
    public async Task Register_TwoUsers_EachGetsOwnCopyOfDefaultCategories()
    {
        using var client = factory.CreateClient();
        var userA = await client.RegisterUserAsync();
        var userB = await client.RegisterUserAsync();

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emails = new[] { userA.Email, userB.Email };
        var counts = await db.Categories
            .Join(db.Users, c => c.UserId, u => u.Id, (c, u) => new { u.Email, c.Id })
            .Where(x => emails.Contains(x.Email))
            .GroupBy(x => x.Email)
            .Select(g => new { Email = g.Key, Count = g.Count() })
            .ToListAsync(CancellationToken);

        counts.Should().HaveCount(2)
            .And.AllSatisfy(c => c.Count.Should().Be(DefaultCategories.All.Count));
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsTokens()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest($"  {user.Email.ToUpperInvariant()} ", user.Password),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var tokens = await response.Content.ReadFromJsonAsync<AuthTokens>(CancellationToken);
        tokens!.AccessToken.Should().NotBeNullOrWhiteSpace();
        tokens.RefreshToken.Should().NotBe(user.Tokens.RefreshToken);
        tokens.ExpiresIn.Should().Be(15 * 60);
    }

    [Fact]
    public async Task Login_WrongPasswordOrUnknownEmail_ReturnsSameUnauthorizedMessage()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        var wrongPassword = await client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest(user.Email, "Wrong1234"),
            CancellationToken);
        var unknownEmail = await client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest(AuthTestExtensions.UniqueEmail(), user.Password),
            CancellationToken);

        foreach (var response in new[] { wrongPassword, unknownEmail })
        {
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
            problem!.Detail.Should().Be("Email or password is incorrect.");
        }
    }

    [Fact]
    public async Task Refresh_ActiveToken_ReturnsNewTokensAndRevokesOldOne()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        var response = await client.RefreshAsync(user.Tokens.RefreshToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var rotated = await response.Content.ReadFromJsonAsync<AuthTokens>(CancellationToken);
        rotated!.RefreshToken.Should().NotBe(user.Tokens.RefreshToken);
        rotated.AccessToken.Should().NotBeNullOrWhiteSpace();

        using var meClient = factory.CreateClientWithToken(rotated.AccessToken);
        (await meClient.GetAsync("/api/me", CancellationToken)).StatusCode.Should().Be(HttpStatusCode.OK);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var oldToken = await db.RefreshTokens
            .SingleAsync(t => t.TokenHash == RefreshTokenCodec.Hash(user.Tokens.RefreshToken), CancellationToken);
        var newToken = await db.RefreshTokens
            .SingleAsync(t => t.TokenHash == RefreshTokenCodec.Hash(rotated.RefreshToken), CancellationToken);
        oldToken.RevokedAt.Should().Be(factory.Time.GetUtcNow());
        oldToken.ReplacedByTokenId.Should().Be(newToken.Id);
        newToken.RevokedAt.Should().BeNull();
    }

    [Fact]
    public async Task Refresh_StoresOnlyTokenHash_RawTokenIsNotPersisted()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        (await db.RefreshTokens.AnyAsync(t => t.TokenHash == user.Tokens.RefreshToken, CancellationToken))
            .Should().BeFalse();
        (await db.RefreshTokens.AnyAsync(
                t => t.TokenHash == RefreshTokenCodec.Hash(user.Tokens.RefreshToken),
                CancellationToken))
            .Should().BeTrue();
    }

    [Fact]
    public async Task Refresh_RevokedTokenReused_RevokesWholeChain()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();
        var first = user.Tokens.RefreshToken;

        var second = (await (await client.RefreshAsync(first)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!.RefreshToken;
        var third = (await (await client.RefreshAsync(second)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!.RefreshToken;

        var reuse = await client.RefreshAsync(first);
        reuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // The newest token in the chain was never used, but the reuse must have revoked it too.
        var afterReuse = await client.RefreshAsync(third);
        afterReuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_ReuseInOneChain_DoesNotAffectOtherSessions()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();
        var otherSession = (await (await client.PostAsJsonAsync(
                "/api/auth/login",
                new LoginRequest(user.Email, user.Password),
                CancellationToken)).Content.ReadFromJsonAsync<AuthTokens>(CancellationToken))!;

        await client.RefreshAsync(user.Tokens.RefreshToken);
        (await client.RefreshAsync(user.Tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        (await client.RefreshAsync(otherSession.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Refresh_ExpiredToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        factory.Time.Advance(TimeSpan.FromDays(14) + TimeSpan.FromMinutes(1));
        var response = await client.RefreshAsync(user.Tokens.RefreshToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("Your session has expired. Log in again.");
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-real-token")]
    public async Task Refresh_UnknownToken_ReturnsUnauthorized(string refreshToken)
    {
        using var client = factory.CreateClient();

        var response = await client.RefreshAsync(refreshToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_OwnRefreshToken_ReturnsNoContentAndRevokesIt()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        var response = await client.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(user.Tokens.RefreshToken),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await anonymous.RefreshAsync(user.Tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        var response = await client.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(user.Tokens.RefreshToken),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.RefreshAsync(user.Tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_EmptyRefreshToken_ReturnsValidationProblem()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        var response = await client.PostAsJsonAsync("/api/auth/logout", new LogoutRequest(""), CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("refreshToken");
    }

    [Fact]
    public async Task Logout_OtherUsersRefreshToken_DoesNotRevokeIt()
    {
        using var anonymous = factory.CreateClient();
        var userA = await anonymous.RegisterUserAsync();
        var userB = await anonymous.RegisterUserAsync();
        using var clientA = factory.CreateClientWithToken(userA.Tokens.AccessToken);

        var response = await clientA.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(userB.Tokens.RefreshToken),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await anonymous.RefreshAsync(userB.Tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_TamperedAccessToken_ReturnsUnauthorized()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", user.Tokens.AccessToken[..^4] + "abcd");

        var response = await client.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(user.Tokens.RefreshToken),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private sealed record SeededCategory(
        string? SystemKey,
        string Name,
        CategoryType Type,
        string Icon,
        string Color,
        bool IsArchived);
}
