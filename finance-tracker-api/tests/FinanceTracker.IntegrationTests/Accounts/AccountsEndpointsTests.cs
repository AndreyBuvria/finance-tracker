using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Me;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Accounts;

public sealed class AccountsEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _accountsUrl = "/api/accounts";

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Create_ValidRequest_ReturnsCreatedAccountInAgreedShape()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new { name = "  Main card  ", type = "Card", currency = "PLN", initialBalance = 1234.56m },
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CancellationToken));
        var root = json.RootElement;
        root.EnumerateObject().Select(p => p.Name).Should()
            .BeEquivalentTo(["id", "name", "type", "currency", "initialBalance", "balance", "isArchived"]);
        root.GetProperty("id").GetGuid().Should().NotBeEmpty();
        root.GetProperty("name").GetString().Should().Be("Main card");
        root.GetProperty("type").GetString().Should().Be("Card");
        root.GetProperty("currency").GetString().Should().Be("PLN");
        root.GetProperty("initialBalance").GetDecimal().Should().Be(1234.56m);
        root.GetProperty("balance").GetDecimal().Should().Be(1234.56m);
        root.GetProperty("isArchived").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Create_CurrencyAndBalanceOmitted_DefaultsToPlnAndZero()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new { name = "Cash", type = "Cash" },
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken);
        account!.Currency.Should().Be("PLN");
        account.InitialBalance.Should().Be(0m);
        account.Balance.Should().Be(0m);
    }

    [Theory]
    [InlineData("""{ "name": " ", "type": "Card" }""", "name", "Enter an account name.")]
    [InlineData("""{ "type": "Card" }""", "name", "Enter an account name.")]
    [InlineData(
        """{ "name": "123456789012345678901234567890123456789012345678901", "type": "Card" }""",
        "name",
        "Name can be at most 50 characters.")]
    [InlineData("""{ "name": "Main card" }""", "type", "Choose an account type.")]
    [InlineData("""{ "name": "Main card", "type": "Card", "currency": "EUR" }""", "currency", "Only PLN is supported for now.")]
    [InlineData(
        """{ "name": "Main card", "type": "Card", "initialBalance": 10.555 }""",
        "initialBalance",
        "Enter an amount with at most 2 decimal places.")]
    [InlineData(
        """{ "name": "Main card", "type": "Card", "initialBalance": 10000000000000000 }""",
        "initialBalance",
        "Enter a smaller amount.")]
    public async Task Create_InvalidField_ReturnsValidationProblem(string body, string field, string expectedMessage)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(_accountsUrl, JsonContent(body), CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }

    [Theory]
    [InlineData("\"Bank\"")]
    [InlineData("1")]
    [InlineData("\"\"")]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("null")]
    public async Task Create_UnknownAccountType_ReturnsTypeFieldError(string typeJson)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(
            _accountsUrl,
            JsonContent($$"""{ "name": "Main card", "type": {{typeJson}} }"""),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().BeEquivalentTo(new Dictionary<string, string[]>
        {
            ["type"] = ["Choose an account type."],
        });
    }

    [Fact]
    public async Task Create_AccountTypeInDifferentCase_IsAccepted()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(
            _accountsUrl,
            JsonContent("""{ "name": "Savings", "type": "savings" }"""),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken);
        account!.Type.Should().Be(AccountType.Savings);
    }

    [Fact]
    public async Task Create_MalformedJson_ReturnsBadRequestWithoutInternalDetails()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(
            _accountsUrl,
            JsonContent("""{ "name": "Main card", "initialBalance": "lots" }"""),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(CancellationToken);
        body.Should().NotContain("FinanceTracker").And.NotContain("System.");
    }

    [Fact]
    public async Task Create_NegativeInitialBalance_IsAllowed()
    {
        using var client = await CreateSignedInClientAsync();

        var account = await CreateAccountAsync(client, "Credit card", initialBalance: -250.40m);

        account.Balance.Should().Be(-250.40m);
    }

    [Fact]
    public async Task Create_DuplicateActiveNameInDifferentCase_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "Main card");

        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new AccountRequest("MAIN CARD", AccountType.Savings, null, null),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("An account with this name already exists.");
    }

    [Fact]
    public async Task Create_DuplicateNameWithPolishLettersInDifferentCase_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "Żabka Łódź");

        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new AccountRequest("ŻABKA ŁÓDŹ", AccountType.Cash, null, null),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("An account with this name already exists.");
    }

    [Fact]
    public async Task Create_ConcurrentRequestsWithSameName_ExactlyOneSucceeds()
    {
        using var client = await CreateSignedInClientAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(i =>
            client.PostAsJsonAsync(
                _accountsUrl,
                new AccountRequest(i % 2 == 0 ? "Savings" : "savings", AccountType.Savings, null, null),
                ApiJson.Options,
                CancellationToken)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).Should().Be(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).Should().Be(4);
        foreach (var conflict in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            var problem = await conflict.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
            problem!.Detail.Should().Be("An account with this name already exists.");
        }
    }

    [Fact]
    public async Task Create_NameOfArchivedAccount_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var old = await CreateAccountAsync(client, "Savings");
        await CreateAccountAsync(client, "Main card");
        (await ArchiveAsync(client, old.Id)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new AccountRequest("savings", AccountType.Savings, null, null),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task List_Default_ReturnsActiveAccountsSortedByNameWithNetWorth()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "savings", AccountType.Savings, 5000m);
        await CreateAccountAsync(client, "Cash", AccountType.Cash, 150.25m);
        var archived = await CreateAccountAsync(client, "Old bank", initialBalance: 999m);
        await CreateAccountAsync(client, "Main card", initialBalance: 1000m);
        await ArchiveAsync(client, archived.Id);

        var list = await ListAsync(client);

        list.Items.Select(a => a.Name).Should().Equal("Cash", "Main card", "savings");
        list.Items.Should().OnlyContain(a => !a.IsArchived);
        list.NetWorth.Should().Be(6150.25m);
    }

    [Fact]
    public async Task List_IncludeArchived_ReturnsArchivedAfterActiveButNetWorthOnlyCountsActive()
    {
        using var client = await CreateSignedInClientAsync();
        var archived = await CreateAccountAsync(client, "Old bank", initialBalance: 999m);
        await CreateAccountAsync(client, "Main card", initialBalance: 1000m);
        await ArchiveAsync(client, archived.Id);

        var list = await ListAsync(client, includeArchived: true);

        list.Items.Select(a => (a.Name, a.IsArchived)).Should().Equal(("Main card", false), ("Old bank", true));
        list.Items[1].Balance.Should().Be(999m);
        list.NetWorth.Should().Be(1000m);
    }

    [Fact]
    public async Task List_WithTransactions_ComputesBalancesFromIncomeExpensesAndTransfers()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var card = await CreateAccountAsync(client, "Main card", initialBalance: 1000m);
        var savings = await CreateAccountAsync(client, "Savings", AccountType.Savings, 200.50m);

        await SeedTransactionsAsync(userId, (db, categories) =>
        {
            db.Transactions.AddRange(
                Expense(userId, card.Id, categories.Groceries, 120.25m),
                Income(userId, card.Id, categories.Salary, 7500m),
                Expense(userId, savings.Id, categories.Groceries, 50m));
            db.Transactions.AddRange(Transfer(userId, from: card.Id, to: savings.Id, 300m));
        });

        var list = await ListAsync(client);

        // Card: 1000 − 120.25 + 7500 − 300 (transfer out); Savings: 200.50 + 300 (transfer in) − 50.
        list.Items.Single(a => a.Id == card.Id).Balance.Should().Be(8079.75m);
        list.Items.Single(a => a.Id == savings.Id).Balance.Should().Be(450.50m);
        list.NetWorth.Should().Be(8530.25m);
    }

    [Fact]
    public async Task List_ArchivedAccountWithTransactions_KeepsBalanceButLeavesNetWorth()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var card = await CreateAccountAsync(client, "Main card", initialBalance: 100m);
        var old = await CreateAccountAsync(client, "Old bank", initialBalance: 50m);
        await SeedTransactionsAsync(userId, (db, categories) =>
            db.Transactions.Add(Income(userId, old.Id, categories.Salary, 25m)));

        await ArchiveAsync(client, old.Id);
        var list = await ListAsync(client, includeArchived: true);

        list.Items.Single(a => a.Id == old.Id).Balance.Should().Be(75m);
        list.Items.Single(a => a.Id == card.Id).Balance.Should().Be(100m);
        list.NetWorth.Should().Be(100m);
    }

    [Fact]
    public async Task Update_NewStartingBalance_ChangesComputedBalance()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var card = await CreateAccountAsync(client, "Main card", initialBalance: 1000m);
        await SeedTransactionsAsync(userId, (db, categories) =>
            db.Transactions.Add(Expense(userId, card.Id, categories.Groceries, 120.25m)));

        var response = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{card.Id}",
            new AccountRequest(" mBank ", AccountType.Savings, "PLN", 500m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken);
        updated.Should().BeEquivalentTo(
            new AccountResponse(card.Id, "mBank", AccountType.Savings, "PLN", 500m, 379.75m, false));
    }

    [Fact]
    public async Task Update_NameOfAnotherActiveAccount_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "Main card");
        var savings = await CreateAccountAsync(client, "Savings");

        var response = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{savings.Id}",
            new AccountRequest("main CARD", AccountType.Savings, null, 0m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("An account with this name already exists.");
    }

    [Fact]
    public async Task Update_OwnNameInDifferentCase_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var card = await CreateAccountAsync(client, "main card");

        var response = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{card.Id}",
            new AccountRequest("Main Card", AccountType.Card, null, 0m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Update_InvalidName_ReturnsValidationProblem()
    {
        using var client = await CreateSignedInClientAsync();
        var card = await CreateAccountAsync(client, "Main card");

        var response = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{card.Id}",
            new AccountRequest("", AccountType.Card, null, 0m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("name").WhoseValue.Should().Equal("Enter an account name.");
    }

    [Fact]
    public async Task Archive_LastActiveAccount_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var card = await CreateAccountAsync(client, "Main card");
        var old = await CreateAccountAsync(client, "Old bank");
        await ArchiveAsync(client, old.Id);

        var response = await ArchiveAsync(client, card.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("You need at least one active account.");
        (await ListAsync(client)).Items.Should().ContainSingle(a => a.Id == card.Id);
    }

    [Fact]
    public async Task Archive_ConcurrentRequestsForLastTwoAccounts_LeavesOneActive()
    {
        using var client = await CreateSignedInClientAsync();
        var card = await CreateAccountAsync(client, "Main card");
        var savings = await CreateAccountAsync(client, "Savings");

        var responses = await Task.WhenAll(ArchiveAsync(client, card.Id), ArchiveAsync(client, savings.Id));

        responses.Select(r => r.StatusCode).Should()
            .BeEquivalentTo([HttpStatusCode.NoContent, HttpStatusCode.Conflict]);
        (await ListAsync(client)).Items.Should().ContainSingle();
    }

    [Fact]
    public async Task Archive_AlreadyArchived_ReturnsNoContent()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "Main card");
        var old = await CreateAccountAsync(client, "Old bank");
        await ArchiveAsync(client, old.Id);

        var response = await ArchiveAsync(client, old.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Archive_AccountWithTransactions_KeepsTransactions()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        await CreateAccountAsync(client, "Main card");
        var old = await CreateAccountAsync(client, "Old bank");
        await SeedTransactionsAsync(userId, (db, categories) =>
            db.Transactions.Add(Expense(userId, old.Id, categories.Groceries, 10m)));

        (await ArchiveAsync(client, old.Id)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Accounts.SingleAsync(a => a.Id == old.Id, CancellationToken)).IsArchived.Should().BeTrue();
        (await db.Transactions.CountAsync(t => t.AccountId == old.Id, CancellationToken)).Should().Be(1);
    }

    [Fact]
    public async Task Restore_ArchivedAccount_MakesItActiveAgain()
    {
        using var client = await CreateSignedInClientAsync();
        await CreateAccountAsync(client, "Main card");
        var old = await CreateAccountAsync(client, "Old bank", initialBalance: 40m);
        await ArchiveAsync(client, old.Id);

        var response = await RestoreAsync(client, old.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var list = await ListAsync(client);
        list.Items.Should().ContainSingle(a => a.Id == old.Id && !a.IsArchived);
        list.NetWorth.Should().Be(40m);
    }

    [Fact]
    public async Task Restore_ActiveAccount_ReturnsNoContent()
    {
        using var client = await CreateSignedInClientAsync();
        var card = await CreateAccountAsync(client, "Main card");

        var response = await RestoreAsync(client, card.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Restore_NameTakenByActiveAccount_ReturnsConflictUntilRenamed()
    {
        using var client = await CreateSignedInClientAsync();
        var old = await CreateAccountAsync(client, "Savings");
        await CreateAccountAsync(client, "Main card");
        await ArchiveAsync(client, old.Id);
        await CreateAccountAsync(client, "SAVINGS");

        var conflict = await RestoreAsync(client, old.Id);

        conflict.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await conflict.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("An account with this name already exists. Rename it first.");

        // Renaming the archived account is allowed and resolves the clash.
        var rename = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{old.Id}",
            new AccountRequest("Old savings", AccountType.Savings, null, 0m),
            ApiJson.Options,
            CancellationToken);
        rename.StatusCode.Should().Be(HttpStatusCode.OK);
        var renamed = await rename.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken);
        renamed!.IsArchived.Should().BeTrue();
        (await RestoreAsync(client, old.Id)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Update_UnknownAccountId_ReturnsNotFound()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PutAsJsonAsync(
            $"{_accountsUrl}/{Guid.NewGuid()}",
            new AccountRequest("Main card", AccountType.Card, null, 0m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This account doesn't exist.");
    }

    [Fact]
    public async Task Archive_UnknownAccountId_ReturnsNotFound()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await ArchiveAsync(client, Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Restore_UnknownAccountId_ReturnsNotFound()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await RestoreAsync(client, Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync(_accountsUrl, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // User isolation: another user's account behaves as if it doesn't exist.

    [Fact]
    public async Task List_TwoUsers_EachSeesOnlyOwnAccountsAndBalances()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var userB = await GetUserIdAsync(clientB);
        await CreateAccountAsync(clientA, "Main card", initialBalance: 100m);
        var accountB = await CreateAccountAsync(clientB, "Main card", initialBalance: 900m);
        await SeedTransactionsAsync(userB, (db, categories) =>
            db.Transactions.Add(Income(userB, accountB.Id, categories.Salary, 1000m)));

        var listA = await ListAsync(clientA, includeArchived: true);
        var listB = await ListAsync(clientB, includeArchived: true);

        listA.Items.Should().ContainSingle().Which.Balance.Should().Be(100m);
        listA.NetWorth.Should().Be(100m);
        listB.Items.Should().ContainSingle().Which.Balance.Should().Be(1900m);
    }

    [Fact]
    public async Task Update_OtherUsersAccount_ReturnsNotFoundAndLeavesItUnchanged()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var accountB = await CreateAccountAsync(clientB, "Main card", initialBalance: 900m);

        var response = await clientA.PutAsJsonAsync(
            $"{_accountsUrl}/{accountB.Id}",
            new AccountRequest("Hacked", AccountType.Cash, null, 0m),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Should().ContainSingle().Which.Should().BeEquivalentTo(accountB);
    }

    [Fact]
    public async Task Archive_OtherUsersAccount_ReturnsNotFoundAndLeavesItActive()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        await CreateAccountAsync(clientA, "Main card");
        await CreateAccountAsync(clientA, "Savings");
        await CreateAccountAsync(clientB, "Main card");
        var accountB = await CreateAccountAsync(clientB, "Savings");

        var response = await ArchiveAsync(clientA, accountB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Should().Contain(a => a.Id == accountB.Id && !a.IsArchived);
    }

    [Fact]
    public async Task Restore_OtherUsersArchivedAccount_ReturnsNotFoundAndLeavesItArchived()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        await CreateAccountAsync(clientB, "Main card");
        var archivedB = await CreateAccountAsync(clientB, "Old bank");
        await ArchiveAsync(clientB, archivedB.Id);

        var response = await RestoreAsync(clientA, archivedB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB, includeArchived: true)).Items
            .Should().ContainSingle(a => a.Id == archivedB.Id).Which.IsArchived.Should().BeTrue();
    }

    [Fact]
    public async Task Create_SameNameAsOtherUsersAccount_Succeeds()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        await CreateAccountAsync(clientB, "Main card");

        var response = await clientA.PostAsJsonAsync(
            _accountsUrl,
            new AccountRequest("Main card", AccountType.Card, null, null),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    private async Task<HttpClient> CreateSignedInClientAsync()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        return factory.CreateClientWithToken(user.Tokens.AccessToken);
    }

    private static async Task<Guid> GetUserIdAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken))!.Id;

    private static async Task<AccountResponse> CreateAccountAsync(
        HttpClient client,
        string name,
        AccountType type = AccountType.Card,
        decimal initialBalance = 0m)
    {
        var response = await client.PostAsJsonAsync(
            _accountsUrl,
            new AccountRequest(name, type, null, initialBalance),
            ApiJson.Options,
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken))!;
    }

    private static async Task<AccountListResponse> ListAsync(HttpClient client, bool includeArchived = false) =>
        (await client.GetFromJsonAsync<AccountListResponse>(
            $"{_accountsUrl}?includeArchived={includeArchived.ToString().ToLowerInvariant()}",
            ApiJson.Options,
            CancellationToken))!;

    private static Task<HttpResponseMessage> ArchiveAsync(HttpClient client, Guid accountId) =>
        client.DeleteAsync($"{_accountsUrl}/{accountId}", CancellationToken);

    private static Task<HttpResponseMessage> RestoreAsync(HttpClient client, Guid accountId) =>
        client.PostAsync($"{_accountsUrl}/{accountId}/restore", null, CancellationToken);

    private static StringContent JsonContent(string json) => new(json, System.Text.Encoding.UTF8, "application/json");

    private sealed record SeededCategories(Guid Groceries, Guid Salary);

    /// <summary>
    /// Inserts transactions straight into the database (the transactions endpoints come in a later task).
    /// </summary>
    private async Task SeedTransactionsAsync(Guid userId, Action<AppDbContext, SeededCategories> seed)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var categoryIds = await db.Categories
            .Where(c => c.UserId == userId && (c.SystemKey == "groceries" || c.SystemKey == "salary"))
            .ToDictionaryAsync(c => c.SystemKey!, c => c.Id, CancellationToken);

        seed(db, new SeededCategories(categoryIds["groceries"], categoryIds["salary"]));
        await db.SaveChangesAsync(CancellationToken);
    }

    private static Transaction Expense(Guid userId, Guid accountId, Guid categoryId, decimal amount) =>
        NewTransaction(userId, accountId, TransactionType.Expense, amount, categoryId: categoryId);

    private static Transaction Income(Guid userId, Guid accountId, Guid categoryId, decimal amount) =>
        NewTransaction(userId, accountId, TransactionType.Income, amount, categoryId: categoryId);

    private static Transaction[] Transfer(Guid userId, Guid from, Guid to, decimal amount)
    {
        var pairId = Guid.NewGuid();
        return
        [
            NewTransaction(userId, from, TransactionType.Transfer, amount, TransferDirection.Out, pairId),
            NewTransaction(userId, to, TransactionType.Transfer, amount, TransferDirection.In, pairId),
        ];
    }

    private static Transaction NewTransaction(
        Guid userId,
        Guid accountId,
        TransactionType type,
        decimal amount,
        TransferDirection? direction = null,
        Guid? transferPairId = null,
        Guid? categoryId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = accountId,
            CategoryId = categoryId,
            Type = type,
            TransferDirection = direction,
            TransferPairId = transferPairId,
            Amount = amount,
            Date = new DateOnly(2026, 10, 20),
            Source = TransactionSource.Manual,
        };
}
