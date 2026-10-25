using System.Net;
using System.Net.Http.Json;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Me;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Enums;

namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>HTTP helpers for tests that work with accounts, categories, transactions and transfers.</summary>
public static class TransactionTestExtensions
{
    public const string TransactionsUrl = "/api/transactions";
    public const string TransfersUrl = "/api/transfers";

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    /// <summary>Registers a new user and returns a client signed in as them.</summary>
    public static async Task<HttpClient> CreateSignedInClientAsync(this ApiFactory factory)
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        return factory.CreateClientWithToken(user.Tokens.AccessToken);
    }

    public static async Task<Guid> GetUserIdAsync(this HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken))!.Id;

    public static async Task<AccountResponse> CreateAccountResponseAsync(
        this HttpClient client,
        string name,
        AccountType type = AccountType.Card,
        decimal initialBalance = 0m)
    {
        var response = await client.PostAsJsonAsync(
            "/api/accounts",
            new AccountRequest(name, type, null, initialBalance),
            ApiJson.Options,
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken))!;
    }

    public static async Task<IReadOnlyList<AccountResponse>> ListAccountsAsync(this HttpClient client) =>
        (await client.GetFromJsonAsync<AccountListResponse>(
            "/api/accounts?includeArchived=true",
            ApiJson.Options,
            CancellationToken))!.Items;

    /// <summary>The user's categories (archived included) keyed by system key, or by name for custom ones.</summary>
    public static async Task<IReadOnlyDictionary<string, CategoryResponse>> GetCategoriesAsync(this HttpClient client)
    {
        var list = await client.GetFromJsonAsync<CategoryListResponse>(
            "/api/categories?includeArchived=true",
            ApiJson.Options,
            CancellationToken);
        return list!.Items.ToDictionary(c => c.SystemKey ?? c.Name);
    }

    public static Task<HttpResponseMessage> PostTransactionAsync(this HttpClient client, TransactionRequest request) =>
        client.PostAsJsonAsync(TransactionsUrl, request, ApiJson.Options, CancellationToken);

    public static async Task<TransactionResponse> CreateTransactionAsync(
        this HttpClient client,
        TransactionRequest request)
    {
        var response = await client.PostTransactionAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<TransactionResponse>(ApiJson.Options, CancellationToken))!;
    }

    public static Task<HttpResponseMessage> PostTransferAsync(this HttpClient client, TransferRequest request) =>
        client.PostAsJsonAsync(TransfersUrl, request, ApiJson.Options, CancellationToken);

    public static async Task<TransactionResponse> CreateTransferAsync(this HttpClient client, TransferRequest request)
    {
        var response = await client.PostTransferAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<TransactionResponse>(ApiJson.Options, CancellationToken))!;
    }

    public static async Task<TransactionPageResponse> ListTransactionsAsync(this HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"{TransactionsUrl}{query}", CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<TransactionPageResponse>(ApiJson.Options, CancellationToken))!;
    }
}
