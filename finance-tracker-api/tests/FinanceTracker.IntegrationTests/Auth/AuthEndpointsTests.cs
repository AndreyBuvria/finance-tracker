using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FinanceTracker.Api.Authentication;
using FinanceTracker.Application.Auth;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace FinanceTracker.IntegrationTests.Auth;

public sealed class AuthEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    /// <summary>The configured refresh-token reuse grace window.</summary>
    private TimeSpan ReuseGraceWindow =>
        factory.Services.GetRequiredService<IOptions<JwtOptions>>().Value.RefreshTokenReuseGraceWindow;

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

    [Theory]
    [InlineData("displayName", 101, "Name can be at most 100 characters.")]
    [InlineData("email", 257, "Email can be at most 256 characters.")]
    [InlineData("password", 129, "Password can be at most 128 characters.")]
    public async Task Register_FieldOverMaxLength_ReturnsFieldError(string field, int length, string expectedMessage)
    {
        using var client = factory.CreateClient();
        const string domain = "@example.com";
        var request = field switch
        {
            "displayName" => new RegisterRequest(new string('a', length), AuthTestExtensions.UniqueEmail(), "Secret123"),
            "email" => new RegisterRequest("Kasia", new string('a', length - domain.Length) + domain, "Secret123"),
            _ => new RegisterRequest("Kasia", AuthTestExtensions.UniqueEmail(), "Secret1" + new string('a', length - 7)),
        };

        var response = await client.PostAsJsonAsync("/api/auth/register", request, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }

    [Fact]
    public async Task Register_PasswordWhoseOnlyDigitIsNonAscii_ReturnsPasswordError()
    {
        using var client = factory.CreateClient();

        // U+0663 ARABIC-INDIC DIGIT THREE is a Unicode digit but not 0-9.
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", AuthTestExtensions.UniqueEmail(), "kasiakasia٣"),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("password").WhoseValue.Should()
            .Equal("Password must include at least one letter and one number.");
    }

    [Fact]
    public async Task Register_ErrorAndSuccessResponses_UseProblemJsonOnlyForErrors()
    {
        using var client = factory.CreateClient();
        var email = AuthTestExtensions.UniqueEmail();

        var created = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", email, "Secret123"),
            CancellationToken);
        var invalid = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("", "", ""),
            CancellationToken);
        var duplicate = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterRequest("Kasia", email, "Secret123"),
            CancellationToken);

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        created.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        invalid.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        duplicate.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
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

        factory.Time.Advance(ReuseGraceWindow);
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
        factory.Time.Advance(ReuseGraceWindow);
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

    [Fact]
    public async Task Refresh_ConcurrentRequestsWithSameToken_BothSucceedAndChainStaysValid()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();

        var responses = await Task.WhenAll(
            client.RefreshAsync(user.Tokens.RefreshToken),
            client.RefreshAsync(user.Tokens.RefreshToken));

        responses.Should().AllSatisfy(r => r.StatusCode.Should().Be(HttpStatusCode.OK));
        var issued = await Task.WhenAll(responses.Select(r => r.Content.ReadFromJsonAsync<AuthTokens>(CancellationToken)));

        // Both callers continue the same chain: they get the same rotated refresh token.
        issued[0]!.RefreshToken.Should().NotBe(user.Tokens.RefreshToken)
            .And.Be(issued[1]!.RefreshToken);
        foreach (var tokens in issued)
        {
            using var meClient = factory.CreateClientWithToken(tokens!.AccessToken);
            (await meClient.GetAsync("/api/me", CancellationToken)).StatusCode.Should().Be(HttpStatusCode.OK);
        }

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users.Where(u => u.Email == user.Email).Select(u => u.Id).SingleAsync(CancellationToken);
        (await db.RefreshTokens.CountAsync(t => t.UserId == userId && t.RevokedAt == null, CancellationToken))
            .Should().Be(1);

        // Well after the window the chain still works.
        factory.Time.Advance(TimeSpan.FromMinutes(14));
        (await client.RefreshAsync(issued[0]!.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Refresh_RotatedTokenReplayedWithinGraceWindow_ReturnsCurrentChainToken()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();
        var rotated = (await (await client.RefreshAsync(user.Tokens.RefreshToken)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!;

        factory.Time.Advance(ReuseGraceWindow - TimeSpan.FromSeconds(1));
        var replay = await client.RefreshAsync(user.Tokens.RefreshToken);

        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        var replayTokens = (await replay.Content.ReadFromJsonAsync<AuthTokens>(CancellationToken))!;
        replayTokens.RefreshToken.Should().Be(rotated.RefreshToken);
        (await client.RefreshAsync(rotated.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Refresh_RotatedTokenReplayedAfterGraceWindow_ReturnsUnauthorizedAndRevokesChain()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();
        var rotated = (await (await client.RefreshAsync(user.Tokens.RefreshToken)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!;

        factory.Time.Advance(ReuseGraceWindow);
        var replay = await client.RefreshAsync(user.Tokens.RefreshToken);

        replay.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.RefreshAsync(rotated.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_LoggedOutTokenWithinGraceWindow_ReturnsUnauthorized()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        var rotated = (await (await anonymous.RefreshAsync(user.Tokens.RefreshToken)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!;
        using var client = factory.CreateClientWithToken(rotated.AccessToken);
        (await client.PostAsJsonAsync("/api/auth/logout", new LogoutRequest(rotated.RefreshToken), CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        factory.Time.Advance(TimeSpan.FromSeconds(1));

        (await anonymous.RefreshAsync(rotated.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        // The rotated predecessor is inside the window, but its chain ends in a logged-out token.
        (await anonymous.RefreshAsync(user.Tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_ReuseRevokedChainWithinGraceWindow_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();
        var user = await client.RegisterUserAsync();
        var first = user.Tokens.RefreshToken;
        var second = (await (await client.RefreshAsync(first)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!.RefreshToken;
        factory.Time.Advance(TimeSpan.FromSeconds(30));
        var third = (await (await client.RefreshAsync(second)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!.RefreshToken;

        // Reusing the oldest token (outside the window) revokes the chain ...
        (await client.RefreshAsync(first)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // ... so the just-rotated token gets no grace, and the newest one is dead too.
        (await client.RefreshAsync(second)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.RefreshAsync(third)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_MissingBody_ReturnsBadRequest()
    {
        using var client = factory.CreateClient();
        using var content = new StringContent(string.Empty, new MediaTypeHeaderValue("application/json"));

        var response = await client.PostAsync("/api/auth/refresh", content, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Status.Should().Be(400);
        problem.Errors.Should().NotBeEmpty();
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
    public async Task Logout_ConcurrentWithRefreshOfSameToken_LeavesNoActiveTokenInChain()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        using var client = factory.CreateClientWithToken(user.Tokens.AccessToken);

        var logout = client.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(user.Tokens.RefreshToken),
            CancellationToken);
        var refresh = anonymous.RefreshAsync(user.Tokens.RefreshToken);
        await Task.WhenAll(logout, refresh);

        (await logout).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ActiveTokenCountAsync(user.Email)).Should().Be(0);
        if ((await refresh).StatusCode == HttpStatusCode.OK)
        {
            var rotated = (await (await refresh).Content.ReadFromJsonAsync<AuthTokens>(CancellationToken))!;
            (await anonymous.RefreshAsync(rotated.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }
    }

    [Fact]
    public async Task Logout_TokenRotatedWithinGraceWindow_RevokesCurrentChainToken()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        var rotated = (await (await anonymous.RefreshAsync(user.Tokens.RefreshToken)).Content
            .ReadFromJsonAsync<AuthTokens>(CancellationToken))!;
        using var client = factory.CreateClientWithToken(rotated.AccessToken);

        factory.Time.Advance(ReuseGraceWindow - TimeSpan.FromSeconds(1));
        var response = await client.PostAsJsonAsync(
            "/api/auth/logout",
            new LogoutRequest(user.Tokens.RefreshToken),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ActiveTokenCountAsync(user.Email)).Should().Be(0);
        (await anonymous.RefreshAsync(rotated.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
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

    private async Task<int> ActiveTokenCountAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync(CancellationToken);
        return await db.RefreshTokens.CountAsync(t => t.UserId == userId && t.RevokedAt == null, CancellationToken);
    }

    private sealed record SeededCategory(
        string? SystemKey,
        string Name,
        CategoryType Type,
        string Icon,
        string Color,
        bool IsArchived);
}
