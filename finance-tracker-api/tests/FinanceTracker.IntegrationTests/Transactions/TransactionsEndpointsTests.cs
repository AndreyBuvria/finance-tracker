using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FinanceTracker.IntegrationTests.Infrastructure.TransactionTestExtensions;

namespace FinanceTracker.IntegrationTests.Transactions;

public sealed class TransactionsEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    /// <summary>The fake clock's date in Warsaw (see <see cref="ApiFactory.Time"/>); the class never advances it.</summary>
    private static readonly DateOnly _today = new(2026, 10, 21);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Create_ValidExpense_ReturnsCreatedRowInAgreedShape()
    {
        var (client, account, categories) = await ArrangeUserAsync();

        var response = await client.PostTransactionAsync(new TransactionRequest(
            TransactionType.Expense,
            24m,
            _today,
            account.Id,
            categories["eating_out"].Id,
            "  Pyszne.pl  ",
            " "));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CancellationToken));
        json.RootElement.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(
        [
            "id", "type", "amount", "date", "merchant", "note", "source", "account", "category", "transfer", "import",
            "needsCategory",
        ]);
        json.RootElement.GetProperty("type").GetString().Should().Be("Expense");
        json.RootElement.GetProperty("date").GetString().Should().Be("2026-10-21");

        var created = json.RootElement.Deserialize<TransactionResponse>(ApiJson.Options)!;
        created.Should().BeEquivalentTo(new
        {
            Amount = 24m,
            Merchant = "Pyszne.pl",
            Note = (string?)null,
            Source = TransactionSource.Manual,
            Account = new { account.Id, Name = "Main card", IsArchived = false },
            Category = new
            {
                categories["eating_out"].Id,
                Name = "Eating out",
                Type = CategoryType.Expense,
                Icon = "restaurant",
                Color = "#ef6c00",
                SystemKey = "eating_out",
                IsArchived = false,
            },
            Transfer = (TransferInfo?)null,
            Import = (TransactionImportInfo?)null,
            NeedsCategory = false,
        });
    }

    [Theory]
    [InlineData("""{ "type": "Expense", "amount": 0, "date": "2026-10-21" }""", "amount", "Enter an amount greater than 0.")]
    [InlineData("""{ "type": "Expense", "amount": -5, "date": "2026-10-21" }""", "amount", "Enter an amount greater than 0.")]
    [InlineData("""{ "type": "Expense", "date": "2026-10-21" }""", "amount", "Enter an amount greater than 0.")]
    [InlineData("""{ "type": "Expense", "amount": 1.234, "date": "2026-10-21" }""", "amount", "Enter an amount with at most 2 decimal places.")]
    [InlineData("""{ "type": "Expense", "amount": 99999999999999999, "date": "2026-10-21" }""", "amount", "Enter a smaller amount.")]
    [InlineData("""{ "type": "Expense", "amount": 5, "date": "2026-10-23" }""", "date", "Date can't be in the future.")]
    [InlineData("""{ "type": "Expense", "amount": 5 }""", "date", "Choose a date.")]
    [InlineData("""{ "amount": 5, "date": "2026-10-21" }""", "type", "Choose a transaction type.")]
    [InlineData("""{ "type": "Refund", "amount": 5, "date": "2026-10-21" }""", "type", "Choose a transaction type.")]
    [InlineData("""{ "type": "Transfer", "amount": 5, "date": "2026-10-21" }""", "type", "Choose Expense or Income. Record transfers as a transfer.")]
    public async Task Create_InvalidField_ReturnsValidationProblem(string body, string field, string expectedMessage)
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var json = body.Replace(
            "{ ",
            $$"""{ "accountId": "{{account.Id}}", "categoryId": "{{categories["groceries"].Id}}", """,
            StringComparison.Ordinal);

        var response = await client.PostAsync(TransactionsUrl, JsonContent(json), CancellationToken);

        await AssertFieldErrorAsync(response, field, expectedMessage);
    }

    [Fact]
    public async Task Create_MissingAccountCategoryAndLongTexts_ReturnsAllFieldErrors()
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.PostTransactionAsync(new TransactionRequest(
            TransactionType.Expense,
            5m,
            _today,
            null,
            Guid.Empty,
            new string('m', 201),
            new string('n', 501)));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().BeEquivalentTo(new Dictionary<string, string[]>
        {
            ["accountId"] = ["Choose an account."],
            ["categoryId"] = ["Choose a category."],
            ["merchant"] = ["Merchant can be at most 200 characters."],
            ["note"] = ["Note can be at most 500 characters."],
        });
    }

    [Fact]
    public async Task Create_DateTomorrowAndVeryOldDate_Succeed()
    {
        var (client, account, categories) = await ArrangeUserAsync();

        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today.AddDays(1)));
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, new DateOnly(1999, 1, 1)));
    }

    [Fact]
    public async Task Create_ExpenseInIncomeCategory_ReturnsCategoryFieldError()
    {
        var (client, account, categories) = await ArrangeUserAsync();

        var response = await client.PostTransactionAsync(new TransactionRequest(
            TransactionType.Expense, 5m, _today, account.Id, categories["salary"].Id, null, null));

        await AssertFieldErrorAsync(response, "categoryId", "Choose an expense category.");
    }

    [Fact]
    public async Task Create_IncomeInExpenseCategory_IsRefundThatLowersSpentNotIncome()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 200m, _today));
        await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 7500m, _today, account.Id, categories["salary"].Id, null, null));

        var refund = await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 80m, _today, account.Id, categories["shopping"].Id, "Zalando", "Returned shoes"));

        refund.Category!.Type.Should().Be(CategoryType.Expense);
        var all = await client.ListTransactionsAsync();
        all.Totals.Should().Be(new TransactionTotals(Income: 7500m, Expenses: 120m, Net: 7380m));
        (await client.ListAccountsAsync()).Single().Balance.Should().Be(7380m);
        (await client.ListTransactionsAsync("?type=Income")).Totals
            .Should().Be(new TransactionTotals(Income: 7500m, Expenses: 0m, Net: 7500m));
    }

    [Fact]
    public async Task List_FilterMatchingOnlyRefunds_FloorsExpensesAtZeroAndKeepsNetConsistent()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 50m, _today.AddDays(-10)));
        await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 80m, _today, account.Id, categories["shopping"].Id, "Zalando", "Refund"));
        await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 1000m, _today, account.Id, categories["salary"].Id, null, null));

        var refundOnly = await client.ListTransactionsAsync($"?categoryId={categories["shopping"].Id}&from={_today:yyyy-MM-dd}");
        var refundsOutweighExpenses = await client.ListTransactionsAsync();

        refundOnly.TotalCount.Should().Be(1);
        refundOnly.Totals.Should().Be(new TransactionTotals(Income: 0m, Expenses: 0m, Net: 0m));
        refundsOutweighExpenses.Totals.Should().Be(new TransactionTotals(Income: 1000m, Expenses: 0m, Net: 1000m));
    }

    [Fact]
    public async Task Create_ArchivedAccount_ReturnsAccountFieldError()
    {
        var (client, _, categories) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings");
        (await client.DeleteAsync($"/api/accounts/{savings.Id}", CancellationToken)).EnsureSuccessStatusCode();

        var response = await client.PostTransactionAsync(Expense(savings.Id, categories["groceries"].Id, 5m, _today));

        await AssertFieldErrorAsync(response, "accountId", "This account is archived. Choose an active account.");
        (await client.ListTransactionsAsync()).TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Create_CategoryArchivedOrMergedAway_ReturnsCategoryFieldError()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        (await client.PostAsync($"/api/categories/{categories["shopping"].Id}/archive", null, CancellationToken))
            .EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync(
            $"/api/categories/{categories["entertainment"].Id}/merge",
            new MergeCategoryRequest(categories["other"].Id),
            ApiJson.Options,
            CancellationToken)).EnsureSuccessStatusCode();

        var hidden = await client.PostTransactionAsync(Expense(account.Id, categories["shopping"].Id, 5m, _today));
        var mergedAway = await client.PostTransactionAsync(
            Expense(account.Id, categories["entertainment"].Id, 5m, _today));

        await AssertFieldErrorAsync(hidden, "categoryId", "This category is hidden. Choose an active category.");
        await AssertFieldErrorAsync(mergedAway, "categoryId", "This category is hidden. Choose an active category.");
    }

    [Fact]
    public async Task Update_AllFields_ReplacesTransactionAndKeepsUnchangedArchivedAccountAndCategory()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var created = await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 5m, _today));
        await client.CreateAccountResponseAsync("Cash", AccountType.Cash);
        (await client.DeleteAsync($"/api/accounts/{account.Id}", CancellationToken)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/categories/{categories["shopping"].Id}/archive", null, CancellationToken))
            .EnsureSuccessStatusCode();

        var response = await PutTransactionAsync(
            client,
            created.Id,
            new TransactionRequest(
                TransactionType.Expense,
                7.5m,
                _today.AddDays(-3),
                account.Id,
                categories["shopping"].Id,
                "IKEA",
                "Shelf"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<TransactionResponse>(ApiJson.Options, CancellationToken);
        updated.Should().BeEquivalentTo(new
        {
            created.Id,
            Amount = 7.5m,
            Date = _today.AddDays(-3),
            Merchant = "IKEA",
            Note = "Shelf",
            Account = new { account.Id, IsArchived = true },
            Category = new { categories["shopping"].Id, IsArchived = true },
        });
    }

    [Fact]
    public async Task Update_ToArchivedCategoryOrOtherType_ReturnsCategoryFieldError()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var created = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));
        (await client.PostAsync($"/api/categories/{categories["shopping"].Id}/archive", null, CancellationToken))
            .EnsureSuccessStatusCode();

        var toArchived = await PutTransactionAsync(
            client,
            created.Id,
            Expense(account.Id, categories["shopping"].Id, 5m, _today));
        var typeMismatch = await PutTransactionAsync(
            client,
            created.Id,
            Expense(account.Id, categories["salary"].Id, 5m, _today));
        var toIncome = await PutTransactionAsync(
            client,
            created.Id,
            new TransactionRequest(TransactionType.Income, 5m, _today, account.Id, categories["salary"].Id, null, null));

        await AssertFieldErrorAsync(toArchived, "categoryId", "This category is hidden. Choose an active category.");
        await AssertFieldErrorAsync(typeMismatch, "categoryId", "Choose an expense category.");
        toIncome.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Update_TransferRow_ReturnsConflict()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var transfer = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 100m, _today, null));

        var response = await PutTransactionAsync(
            client,
            transfer.Id,
            Expense(account.Id, categories["groceries"].Id, 5m, _today));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This transaction is part of a transfer. Edit or delete the transfer instead.");
    }

    [Fact]
    public async Task Delete_TransferRowOrItsInSide_DeletesWholePair()
    {
        var (client, account, _) = await ArrangeUserAsync();
        var userId = await client.GetUserIdAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var listed = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 100m, _today, null));
        var other = await client.CreateTransferAsync(new TransferRequest(savings.Id, account.Id, 30m, _today, null));
        Guid otherInRowId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            otherInRowId = await db.Transactions
                .Where(t => t.TransferPairId == other.Transfer!.TransferPairId && t.TransferDirection == TransferDirection.In)
                .Select(t => t.Id)
                .SingleAsync(CancellationToken);
        }

        var deleteListed = await client.DeleteAsync($"{TransactionsUrl}/{listed.Id}", CancellationToken);
        var deleteInSide = await client.DeleteAsync($"{TransactionsUrl}/{otherInRowId}", CancellationToken);

        deleteListed.StatusCode.Should().Be(HttpStatusCode.NoContent);
        deleteInSide.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await using var check = factory.Services.CreateAsyncScope();
        (await check.ServiceProvider.GetRequiredService<AppDbContext>().Transactions
            .CountAsync(t => t.UserId == userId, CancellationToken)).Should().Be(0);
        (await client.ListAccountsAsync()).Should().OnlyContain(a => a.Balance == 0m);
    }

    [Fact]
    public async Task Delete_ManualTransaction_RemovesItWithoutTombstone()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var created = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));

        var response = await client.DeleteAsync($"{TransactionsUrl}/{created.Id}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.ListTransactionsAsync()).TotalCount.Should().Be(0);
        (await CountTombstonesAsync(account.Id)).Should().Be(0);
        (await client.DeleteAsync($"{TransactionsUrl}/{created.Id}", CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_ImportedTransaction_WritesTombstoneWithItsHash()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var userId = await client.GetUserIdAsync();
        var imported = await SeedImportedAsync(userId, account.Id, categories["other"].Id, "ZABKA Z1234", Hash('a'));

        var row = (await client.ListTransactionsAsync()).Items.Single();
        row.Should().BeEquivalentTo(new
        {
            Source = TransactionSource.Csv,
            NeedsCategory = true,
            Import = new { BatchId = imported.ImportBatchId },
        });

        var response = await client.DeleteAsync($"{TransactionsUrl}/{imported.Id}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var tombstones = await db.DeletedImportHashes.Where(h => h.AccountId == account.Id).ToListAsync(CancellationToken);
        tombstones.Should().ContainSingle().Which.ExternalHash.Should().Be(Hash('a'));
    }

    [Fact]
    public async Task Update_ImportedTransaction_KeepsSourceAndHash()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var userId = await client.GetUserIdAsync();
        var imported = await SeedImportedAsync(userId, account.Id, categories["other"].Id, "BOLT.EU", Hash('b'));

        var response = await PutTransactionAsync(
            client,
            imported.Id,
            Expense(account.Id, categories["transport"].Id, 19.99m, _today.AddDays(-1), "BOLT.EU"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<TransactionResponse>(ApiJson.Options, CancellationToken);
        updated!.Should().BeEquivalentTo(new { Source = TransactionSource.Csv, NeedsCategory = false, Amount = 19.99m });
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Transactions.SingleAsync(t => t.Id == imported.Id, CancellationToken))
            .ExternalHash.Should().Be(Hash('b'));
    }

    [Fact]
    public async Task List_DefaultPaging_Returns50NewestFirstWithTotalsForWholeSet()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var userId = await client.GetUserIdAsync();
        await SeedAsync(db =>
        {
            for (var i = 0; i < 60; i++)
            {
                db.Transactions.Add(NewRow(userId, account.Id, categories["groceries"].Id, TransactionType.Expense, 10m, _today.AddDays(-i)));
            }

            db.Transactions.Add(NewRow(userId, account.Id, categories["salary"].Id, TransactionType.Income, 7500m, _today.AddDays(-70)));
        });

        var first = await client.ListTransactionsAsync();
        var second = await client.ListTransactionsAsync("?page=2");
        var beyond = await client.ListTransactionsAsync("?page=9");

        first.Should().BeEquivalentTo(new { Page = 1, PageSize = 50, TotalCount = 61, TotalPages = 2 });
        first.Items.Should().HaveCount(50);
        first.Items[0].Date.Should().Be(_today);
        first.Items.Select(t => t.Date).Should().BeInDescendingOrder();
        second.Items.Should().HaveCount(11);
        second.Items[^1].Type.Should().Be(TransactionType.Income);
        first.Items.Select(t => t.Id).Should().NotIntersectWith(second.Items.Select(t => t.Id));
        beyond.Items.Should().BeEmpty();
        beyond.TotalCount.Should().Be(61);

        foreach (var page in new[] { first, second, beyond })
        {
            page.Totals.Should().Be(new TransactionTotals(7500m, 600m, 6900m));
        }
    }

    [Fact]
    public async Task List_Filters_CombineAndTotalsFollowThem()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var cash = await client.CreateAccountResponseAsync("Cash", AccountType.Cash);
        var groceries = categories["groceries"].Id;
        var transport = categories["transport"].Id;
        var lunch = await client.CreateTransactionAsync(Expense(account.Id, categories["eating_out"].Id, 40m, _today));
        var shop = await client.CreateTransactionAsync(Expense(account.Id, groceries, 120m, _today.AddDays(-2)));
        var bus = await client.CreateTransactionAsync(Expense(cash.Id, transport, 4.40m, _today.AddDays(-5)));
        var old = await client.CreateTransactionAsync(Expense(account.Id, groceries, 15m, new DateOnly(2026, 9, 30)));
        var salary = await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 7500m, _today.AddDays(-11), account.Id, categories["salary"].Id, null, null));

        async Task<IEnumerable<Guid>> IdsAsync(string query) =>
            (await client.ListTransactionsAsync(query)).Items.Select(t => t.Id);

        (await IdsAsync("?from=2026-10-01&to=2026-10-31")).Should().BeEquivalentTo([lunch.Id, shop.Id, bus.Id, salary.Id]);
        (await IdsAsync($"?accountId={cash.Id}")).Should().Equal(bus.Id);
        (await IdsAsync($"?categoryId={groceries}&categoryId={transport}")).Should().Equal(shop.Id, bus.Id, old.Id);
        (await IdsAsync("?type=income")).Should().Equal(salary.Id);
        (await IdsAsync("?minAmount=15&maxAmount=120")).Should().Equal(lunch.Id, shop.Id, old.Id);
        (await IdsAsync($"?from=2026-10-01&categoryId={groceries}&maxAmount=200")).Should().Equal(shop.Id);
        (await IdsAsync("?type=")).Should().HaveCount(5);

        var october = await client.ListTransactionsAsync("?from=2026-10-01&to=2026-10-31");
        october.Totals.Should().Be(new TransactionTotals(7500m, 164.40m, 7335.60m));
    }

    [Theory]
    [InlineData("zabka")]
    [InlineData("ŻABKA")]
    [InlineData("Żab")]
    [InlineData("zAbKa z")]
    public async Task List_SearchIgnoringCaseAndPolishDiacritics_FindsMerchant(string q)
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var zabka = await client.CreateTransactionAsync(
            Expense(account.Id, categories["groceries"].Id, 12.5m, _today, "Żabka Złota 44"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 30m, _today, "Biedronka"));

        var result = await client.ListTransactionsAsync($"?q={Uri.EscapeDataString(q)}");

        result.Items.Select(t => t.Id).Should().Equal(zabka.Id);
    }

    [Fact]
    public async Task List_SearchInNoteAndLikeWildcards_MatchesLiterally()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var gift = await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Expense, 50m, _today, account.Id, categories["shopping"].Id, "Empik", "Prezent dla Łucji"));
        var discount = await client.CreateTransactionAsync(
            Expense(account.Id, categories["shopping"].Id, 9m, _today, "Rabat 100% Zara"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 9m, _today, "Rabat 100 zł"));

        (await client.ListTransactionsAsync("?q=lucji")).Items.Select(t => t.Id).Should().Equal(gift.Id);
        (await client.ListTransactionsAsync("?q=100%25")).Items.Select(t => t.Id).Should().Equal(discount.Id);
        (await client.ListTransactionsAsync("?q=_")).Items.Should().BeEmpty();
    }

    [Theory]
    [InlineData("amount")]
    [InlineData("-amount")]
    [InlineData("merchant")]
    [InlineData("-merchant")]
    [InlineData("date")]
    [InlineData("-DATE")]
    public async Task List_Sort_OrdersByAllowListedFieldWithStableTieBreak(string sort)
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var groceries = categories["groceries"].Id;
        var rows = new List<TransactionResponse>
        {
            await client.CreateTransactionAsync(Expense(account.Id, groceries, 20m, _today, "biedronka")),
            await client.CreateTransactionAsync(Expense(account.Id, groceries, 5m, _today.AddDays(-1), "Auchan")),
            await client.CreateTransactionAsync(Expense(account.Id, groceries, 20m, _today.AddDays(-1))),
            await client.CreateTransactionAsync(Expense(account.Id, groceries, 99m, _today.AddDays(-2), "Lidl")),
        };

        var result = await client.ListTransactionsAsync($"?sort={sort}");

        // Ties are broken by ID in the sort direction (PostgreSQL orders UUIDs like their text form); merchant sorts
        // case-insensitively with rows without a merchant last.
        var descending = sort.StartsWith('-');
        Func<TransactionResponse, IComparable> key = sort.TrimStart('-').ToLowerInvariant() switch
        {
            "amount" => t => t.Amount,
            "merchant" => t => t.Merchant?.ToLowerInvariant() ?? "",
            _ => t => t.Date,
        };
        var withoutMerchantLast = rows.OrderBy(t => sort.Contains("merchant", StringComparison.Ordinal) && t.Merchant is null);
        var expected = descending
            ? withoutMerchantLast.ThenByDescending(key).ThenByDescending(t => t.Id.ToString(), StringComparer.Ordinal)
            : withoutMerchantLast.ThenBy(key).ThenBy(t => t.Id.ToString(), StringComparer.Ordinal);
        result.Items.Select(t => t.Id).Should().Equal(expected.Select(t => t.Id));
    }

    [Theory]
    [InlineData("?type=Refund", "type", "Choose a transaction type.")]
    [InlineData("?type=1", "type", "Choose a transaction type.")]
    [InlineData("?from=2026-10-10&to=2026-10-01", "to", "End date can't be before start date.")]
    [InlineData("?minAmount=-1", "minAmount", "Enter an amount of 0 or more.")]
    [InlineData("?minAmount=50&maxAmount=10", "maxAmount", "Maximum amount can't be less than minimum amount.")]
    [InlineData("?page=0", "page", "Page must be 1 or more.")]
    [InlineData("?pageSize=201", "pageSize", "Page size must be between 1 and 200.")]
    [InlineData("?pageSize=0", "pageSize", "Page size must be between 1 and 200.")]
    [InlineData("?sort=note", "sort", "Sort by date, amount, merchant, category or account.")]
    [InlineData("?sort=-1", "sort", "Sort by date, amount, merchant, category or account.")]
    public async Task List_InvalidQuery_ReturnsFieldError(string query, string field, string expectedMessage)
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.GetAsync($"{TransactionsUrl}{query}", CancellationToken);

        await AssertFieldErrorAsync(response, field, expectedMessage);
    }

    [Theory]
    [InlineData("?from=yesterday", "from")]
    [InlineData("?minAmount=1,5", "minAmount")]
    [InlineData("?maxAmount=abc", "maxAmount")]
    [InlineData("?page=x", "page")]
    [InlineData("?categoryId=nope", "categoryId")]
    public async Task List_UnreadableQueryValue_ReturnsCamelCaseFieldError(string query, string field)
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.GetAsync($"{TransactionsUrl}{query}", CancellationToken);

        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        await AssertFieldErrorAsync(response, field, "Enter a valid value.");
    }

    [Fact]
    public async Task List_DecimalAmountFilterWithDot_IsAccepted()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 1.5m, _today));
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 15m, _today));

        (await client.ListTransactionsAsync("?maxAmount=1.5")).Items.Should().ContainSingle().Which.Amount.Should().Be(1.5m);
    }

    [Fact]
    public async Task List_SearchTooLong_ReturnsFieldError()
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.GetAsync($"{TransactionsUrl}?q={new string('a', 101)}", CancellationToken);

        await AssertFieldErrorAsync(response, "q", "Search can be at most 100 characters.");
    }

    [Fact]
    public async Task List_TransactionInArchivedAccount_IsListedWithArchivedFlag()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        await client.CreateAccountResponseAsync("Cash", AccountType.Cash);
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));
        (await client.DeleteAsync($"/api/accounts/{account.Id}", CancellationToken)).EnsureSuccessStatusCode();

        var row = (await client.ListTransactionsAsync()).Items.Single();

        row.Account.Should().Be(new TransactionAccount(account.Id, "Main card", IsArchived: true));
    }

    [Fact]
    public async Task Merchants_Query_ReturnsMatchesWithLastUsedActiveCategory()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 10m, _today.AddDays(-9), "Żabka"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["eating_out"].Id, 10m, _today.AddDays(-1), "Żabka"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 10m, _today, "Żabka"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["eating_out"].Id, 10m, _today, "Pizza Zabkowska"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 10m, _today.AddDays(-30), "LIDL"));
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 10m, _today.AddDays(-2), "Lidl"));
        (await client.PostAsync($"/api/categories/{categories["shopping"].Id}/archive", null, CancellationToken))
            .EnsureSuccessStatusCode();

        var response = await client.GetFromJsonAsync<MerchantListResponse>(
            $"{TransactionsUrl}/merchants?q=zab",
            ApiJson.Options,
            CancellationToken);

        response!.Items.Select(m => m.Merchant).Should().Equal("Żabka", "Pizza Zabkowska");
        response.Items[0].Should().BeEquivalentTo(new
        {
            LastUsedOn = _today,
            LastCategory = new { categories["eating_out"].Id, Name = "Eating out", Type = CategoryType.Expense },
        });

        var all = await client.GetFromJsonAsync<MerchantListResponse>(
            $"{TransactionsUrl}/merchants?limit=2",
            ApiJson.Options,
            CancellationToken);
        all!.Items.Should().HaveCount(2);

        var lidl = await client.GetFromJsonAsync<MerchantListResponse>(
            $"{TransactionsUrl}/merchants?q=lidl",
            ApiJson.Options,
            CancellationToken);
        lidl!.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Merchant = "Lidl",
            LastUsedOn = _today.AddDays(-2),
            LastCategory = new { categories["groceries"].Id },
        });
    }

    [Fact]
    public async Task Merchants_LimitOutOfRange_ReturnsFieldError()
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.GetAsync($"{TransactionsUrl}/merchants?limit=21", CancellationToken);

        await AssertFieldErrorAsync(response, "limit", "Limit must be between 1 and 20.");
    }

    [Fact]
    public async Task Bulk_Recategorize_MovesAllSelected()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var a = await client.CreateTransactionAsync(Expense(account.Id, categories["other"].Id, 5m, _today));
        var b = await client.CreateTransactionAsync(Expense(account.Id, categories["shopping"].Id, 6m, _today));
        var untouched = await client.CreateTransactionAsync(Expense(account.Id, categories["other"].Id, 7m, _today));

        var response = await BulkAsync(client, BulkTransactionAction.Recategorize, [a.Id, b.Id, a.Id], categories["groceries"].Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<BulkTransactionResponse>(ApiJson.Options, CancellationToken))!
            .AffectedCount.Should().Be(2);
        var rows = (await client.ListTransactionsAsync()).Items.ToDictionary(t => t.Id, t => t.Category!.Id);
        rows[a.Id].Should().Be(categories["groceries"].Id);
        rows[b.Id].Should().Be(categories["groceries"].Id);
        rows[untouched.Id].Should().Be(categories["other"].Id);
    }

    [Fact]
    public async Task Bulk_RecategorizeInvalidSelection_ChangesNothing()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var expense = await client.CreateTransactionAsync(Expense(account.Id, categories["other"].Id, 5m, _today));
        var income = await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 50m, _today, account.Id, categories["salary"].Id, null, null));
        var transfer = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 10m, _today, null));
        (await client.PostAsync($"/api/categories/{categories["shopping"].Id}/archive", null, CancellationToken))
            .EnsureSuccessStatusCode();

        var mixed = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id, income.Id], categories["other_income"].Id);
        var withTransfer = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id, transfer.Id], categories["groceries"].Id);
        var wrongType = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id], categories["salary"].Id);
        var archived = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id], categories["shopping"].Id);
        var noCategory = await BulkAsync(client, BulkTransactionAction.Recategorize, [expense.Id], null);

        await AssertFieldErrorAsync(mixed, "transactionIds", "Select only expenses or only income to change their category.");
        await AssertFieldErrorAsync(withTransfer, "transactionIds", "Transfers don't have a category. Unselect them first.");
        await AssertFieldErrorAsync(wrongType, "categoryId", "Choose an expense category.");
        await AssertFieldErrorAsync(archived, "categoryId", "This category is hidden. Choose an active category.");
        await AssertFieldErrorAsync(noCategory, "categoryId", "Choose a category.");
        (await client.ListTransactionsAsync()).Items.Single(t => t.Id == expense.Id)
            .Category!.Id.Should().Be(categories["other"].Id);
    }

    [Fact]
    public async Task Bulk_RecategorizeMixedIntoExpenseCategory_MakesIncomeARefund()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var expense = await client.CreateTransactionAsync(Expense(account.Id, categories["other"].Id, 50m, _today));
        var income = await client.CreateTransactionAsync(new TransactionRequest(
            TransactionType.Income, 20m, _today, account.Id, categories["other_income"].Id, null, null));

        var response = await BulkAsync(
            client,
            BulkTransactionAction.Recategorize,
            [expense.Id, income.Id],
            categories["shopping"].Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await client.ListTransactionsAsync();
        list.Items.Should().OnlyContain(t => t.Category!.Id == categories["shopping"].Id);
        list.Totals.Should().Be(new TransactionTotals(Income: 0m, Expenses: 30m, Net: -30m));
    }

    [Theory]
    [InlineData("""{ "transactionIds": [] }""", "action", "Choose an action.")]
    [InlineData("""{ "action": "Archive", "transactionIds": [] }""", "action", "Choose an action.")]
    [InlineData("""{ "action": "Delete", "transactionIds": [] }""", "transactionIds", "Select at least one transaction.")]
    [InlineData("""{ "action": "Delete" }""", "transactionIds", "Select at least one transaction.")]
    public async Task Bulk_InvalidRequest_ReturnsFieldError(string body, string field, string expectedMessage)
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await client.PostAsync($"{TransactionsUrl}/bulk", JsonContent(body), CancellationToken);

        await AssertFieldErrorAsync(response, field, expectedMessage);
    }

    [Fact]
    public async Task Bulk_TooManyIds_ReturnsFieldError()
    {
        var (client, _, _) = await ArrangeUserAsync();

        var response = await BulkAsync(
            client,
            BulkTransactionAction.Delete,
            [.. Enumerable.Range(0, 501).Select(_ => Guid.NewGuid())],
            null);

        await AssertFieldErrorAsync(response, "transactionIds", "Select at most 500 transactions at once.");
    }

    [Fact]
    public async Task Bulk_DeleteWithTransferAndImportedRow_DeletesPairAndWritesTombstone()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var userId = await client.GetUserIdAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var manual = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));
        var keep = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 6m, _today));
        var transfer = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 100m, _today, null));
        var imported = await SeedImportedAsync(userId, account.Id, categories["other"].Id, "LIDL", Hash('c'));

        var response = await BulkAsync(client, BulkTransactionAction.Delete, [manual.Id, transfer.Id, imported.Id], null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<BulkTransactionResponse>(ApiJson.Options, CancellationToken))!
            .AffectedCount.Should().Be(3);
        (await client.ListTransactionsAsync()).Items.Select(t => t.Id).Should().Equal(keep.Id);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Transactions.CountAsync(t => t.UserId == userId, CancellationToken)).Should().Be(1);
        (await CountTombstonesAsync(account.Id)).Should().Be(1);
    }

    [Fact]
    public async Task Bulk_DeleteWithUnknownId_DeletesNothing()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var created = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));

        var response = await BulkAsync(client, BulkTransactionAction.Delete, [created.Id, Guid.NewGuid()], null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.ListTransactionsAsync()).TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task Transfer_Create_IsOneNeutralRowAndMovesBothBalances()
    {
        var (client, account, categories) = await ArrangeUserAsync(initialBalance: 1000m);
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings, 200m);
        await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 50m, _today));

        var transfer = await client.CreateTransferAsync(
            new TransferRequest(account.Id, savings.Id, 300m, _today, "  Holiday fund "));

        transfer.Should().BeEquivalentTo(new
        {
            Type = TransactionType.Transfer,
            Amount = 300m,
            Note = "Holiday fund",
            Category = (TransactionCategory?)null,
            Account = new { account.Id },
            Transfer = new
            {
                FromAccount = new { account.Id, Name = "Main card" },
                ToAccount = new { savings.Id, Name = "Savings" },
            },
        });

        var balances = (await client.ListAccountsAsync()).ToDictionary(a => a.Id, a => a.Balance);
        balances[account.Id].Should().Be(650m);
        balances[savings.Id].Should().Be(500m);

        var all = await client.ListTransactionsAsync();
        all.TotalCount.Should().Be(2);
        all.Totals.Should().Be(new TransactionTotals(0m, 50m, -50m));
        (await client.ListTransactionsAsync($"?accountId={savings.Id}")).Items.Select(t => t.Id)
            .Should().Equal(transfer.Id);
        (await client.ListTransactionsAsync("?type=Transfer")).Items.Single().Transfer!.TransferPairId
            .Should().Be(transfer.Transfer!.TransferPairId);
    }

    [Theory]
    [InlineData("same", "toAccountId", "Choose two different accounts.")]
    [InlineData("noFrom", "fromAccountId", "Choose the account to move money from.")]
    [InlineData("noTo", "toAccountId", "Choose the account to move money to.")]
    [InlineData("zero", "amount", "Enter an amount greater than 0.")]
    [InlineData("future", "date", "Date can't be in the future.")]
    public async Task Transfer_CreateInvalid_ReturnsFieldError(string scenario, string field, string expectedMessage)
    {
        var (client, account, _) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var request = scenario switch
        {
            "same" => new TransferRequest(account.Id, account.Id, 5m, _today, null),
            "noFrom" => new TransferRequest(null, savings.Id, 5m, _today, null),
            "noTo" => new TransferRequest(account.Id, null, 5m, _today, null),
            "zero" => new TransferRequest(account.Id, savings.Id, 0m, _today, null),
            _ => new TransferRequest(account.Id, savings.Id, 5m, _today.AddDays(2), null),
        };

        var response = await client.PostTransferAsync(request);

        await AssertFieldErrorAsync(response, field, expectedMessage);
    }

    [Fact]
    public async Task Transfer_CreateFromArchivedAccount_ReturnsFieldError()
    {
        var (client, account, _) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        (await client.DeleteAsync($"/api/accounts/{savings.Id}", CancellationToken)).EnsureSuccessStatusCode();

        var response = await client.PostTransferAsync(new TransferRequest(savings.Id, account.Id, 5m, _today, null));

        await AssertFieldErrorAsync(response, "fromAccountId", "This account is archived. Choose an active account.");
    }

    [Fact]
    public async Task Transfer_Update_ChangesBothSides()
    {
        var (client, account, _) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var cash = await client.CreateAccountResponseAsync("Cash", AccountType.Cash);
        var transfer = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 100m, _today, null));
        var pairId = transfer.Transfer!.TransferPairId;

        var response = await client.PutAsJsonAsync(
            $"{TransfersUrl}/{pairId}",
            new TransferRequest(cash.Id, account.Id, 40m, _today.AddDays(-1), "ATM"),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<TransactionResponse>(ApiJson.Options, CancellationToken);
        updated!.Transfer.Should().BeEquivalentTo(new
        {
            TransferPairId = pairId,
            FromAccount = new { cash.Id },
            ToAccount = new { account.Id },
        });

        var balances = (await client.ListAccountsAsync()).ToDictionary(a => a.Id, a => a.Balance);
        balances[cash.Id].Should().Be(-40m);
        balances[account.Id].Should().Be(40m);
        balances[savings.Id].Should().Be(0m);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.Transactions.Where(t => t.TransferPairId == pairId).ToListAsync(CancellationToken);
        rows.Should().HaveCount(2).And.OnlyContain(r => r.Amount == 40m && r.Date == _today.AddDays(-1) && r.Note == "ATM");
    }

    [Fact]
    public async Task Transfer_Delete_RemovesBothSides()
    {
        var (client, account, _) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var transfer = await client.CreateTransferAsync(new TransferRequest(account.Id, savings.Id, 100m, _today, null));
        var pairId = transfer.Transfer!.TransferPairId;

        var response = await client.DeleteAsync($"{TransfersUrl}/{pairId}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.ListAccountsAsync()).Should().OnlyContain(a => a.Balance == 0m);
        (await client.DeleteAsync($"{TransfersUrl}/{pairId}", CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Transfer_UpdateOrDeleteWithPlainTransactionId_ReturnsNotFound()
    {
        var (client, account, categories) = await ArrangeUserAsync();
        var savings = await client.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var expense = await client.CreateTransactionAsync(Expense(account.Id, categories["groceries"].Id, 5m, _today));

        var put = await client.PutAsJsonAsync(
            $"{TransfersUrl}/{expense.Id}",
            new TransferRequest(account.Id, savings.Id, 5m, _today, null),
            ApiJson.Options,
            CancellationToken);
        var delete = await client.DeleteAsync($"{TransfersUrl}/{expense.Id}", CancellationToken);

        put.StatusCode.Should().Be(HttpStatusCode.NotFound);
        delete.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.ListTransactionsAsync()).TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync(TransactionsUrl, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ---- User isolation: another user's IDs behave as if they don't exist. ----

    [Fact]
    public async Task ListAndMerchants_TwoUsers_EachSeesOnlyOwnData()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, categoriesB) = await ArrangeUserAsync();
        await clientA.CreateTransactionAsync(Expense(accountA.Id, categoriesA["groceries"].Id, 5m, _today, "Żabka A"));
        await clientB.CreateTransactionAsync(Expense(accountB.Id, categoriesB["groceries"].Id, 7m, _today, "Żabka B"));

        var listA = await clientA.ListTransactionsAsync();
        var filteredByB = await clientA.ListTransactionsAsync($"?accountId={accountB.Id}");
        var merchantsA = await clientA.GetFromJsonAsync<MerchantListResponse>(
            $"{TransactionsUrl}/merchants?q=zabka",
            ApiJson.Options,
            CancellationToken);

        listA.Items.Should().ContainSingle().Which.Merchant.Should().Be("Żabka A");
        listA.Totals.Expenses.Should().Be(5m);
        filteredByB.TotalCount.Should().Be(0);
        merchantsA!.Items.Select(m => m.Merchant).Should().Equal("Żabka A");
    }

    [Fact]
    public async Task UpdateAndDelete_OtherUsersTransaction_ReturnNotFoundAndLeaveItUnchanged()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, categoriesB) = await ArrangeUserAsync();
        var foreign = await clientB.CreateTransactionAsync(Expense(accountB.Id, categoriesB["groceries"].Id, 7m, _today));

        var put = await PutTransactionAsync(clientA, foreign.Id, Expense(accountA.Id, categoriesA["groceries"].Id, 1m, _today));
        var delete = await clientA.DeleteAsync($"{TransactionsUrl}/{foreign.Id}", CancellationToken);
        var bulkDelete = await BulkAsync(clientA, BulkTransactionAction.Delete, [foreign.Id], null);
        var bulkMove = await BulkAsync(clientA, BulkTransactionAction.Recategorize, [foreign.Id], categoriesA["other"].Id);

        foreach (var response in new[] { put, delete, bulkDelete, bulkMove })
        {
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        (await clientB.ListTransactionsAsync()).Items.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { foreign.Id, Amount = 7m, Category = new { categoriesB["groceries"].Id } });
    }

    [Fact]
    public async Task CreateAndUpdate_WithOtherUsersAccountOrCategory_ReturnNotFound()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, categoriesB) = await ArrangeUserAsync();
        var own = await clientA.CreateTransactionAsync(Expense(accountA.Id, categoriesA["groceries"].Id, 5m, _today));

        var foreignAccount = await clientA.PostTransactionAsync(Expense(accountB.Id, categoriesA["groceries"].Id, 5m, _today));
        var foreignCategory = await clientA.PostTransactionAsync(Expense(accountA.Id, categoriesB["groceries"].Id, 5m, _today));
        var updateToForeignCategory = await PutTransactionAsync(
            clientA,
            own.Id,
            Expense(accountA.Id, categoriesB["groceries"].Id, 5m, _today));
        var bulkToForeignCategory = await BulkAsync(
            clientA,
            BulkTransactionAction.Recategorize,
            [own.Id],
            categoriesB["groceries"].Id);

        foreach (var response in new[] { foreignAccount, foreignCategory, updateToForeignCategory, bulkToForeignCategory })
        {
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        (await clientA.ListTransactionsAsync()).Items.Should().ContainSingle()
            .Which.Category!.Id.Should().Be(categoriesA["groceries"].Id);
        (await clientB.ListTransactionsAsync()).TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Transfers_OtherUsersPairOrAccount_ReturnNotFound()
    {
        var (clientA, accountA, _) = await ArrangeUserAsync();
        var (clientB, accountB, _) = await ArrangeUserAsync();
        var savingsA = await clientA.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var savingsB = await clientB.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var foreign = await clientB.CreateTransferAsync(new TransferRequest(accountB.Id, savingsB.Id, 100m, _today, null));
        var pairId = foreign.Transfer!.TransferPairId;

        var put = await clientA.PutAsJsonAsync(
            $"{TransfersUrl}/{pairId}",
            new TransferRequest(accountA.Id, savingsA.Id, 1m, _today, null),
            ApiJson.Options,
            CancellationToken);
        var delete = await clientA.DeleteAsync($"{TransfersUrl}/{pairId}", CancellationToken);
        var intoForeign = await clientA.PostTransferAsync(new TransferRequest(accountA.Id, savingsB.Id, 1m, _today, null));
        var fromForeign = await clientA.PostTransferAsync(new TransferRequest(accountB.Id, savingsA.Id, 1m, _today, null));

        foreach (var response in new[] { put, delete, intoForeign, fromForeign })
        {
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        var balancesB = (await clientB.ListAccountsAsync()).ToDictionary(a => a.Id, a => a.Balance);
        balancesB[accountB.Id].Should().Be(-100m);
        balancesB[savingsB.Id].Should().Be(100m);
        (await clientA.ListAccountsAsync()).Should().OnlyContain(a => a.Balance == 0m);
    }

    [Fact]
    public async Task List_FilterByOtherUsersCategory_ReturnsNothing()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, categoriesB) = await ArrangeUserAsync();
        await clientA.CreateTransactionAsync(Expense(accountA.Id, categoriesA["groceries"].Id, 5m, _today));
        await clientB.CreateTransactionAsync(Expense(accountB.Id, categoriesB["groceries"].Id, 7m, _today));

        var page = await clientA.ListTransactionsAsync($"?categoryId={categoriesB["groceries"].Id}");

        page.TotalCount.Should().Be(0);
        page.Items.Should().BeEmpty();
        page.Totals.Should().Be(new TransactionTotals(Income: 0m, Expenses: 0m, Net: 0m));
    }

    [Fact]
    public async Task Update_OwnTransactionIntoOtherUsersAccount_ReturnsNotFoundAndLeavesItUnchanged()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, _) = await ArrangeUserAsync();
        var own = await clientA.CreateTransactionAsync(Expense(accountA.Id, categoriesA["groceries"].Id, 5m, _today));

        var response = await PutTransactionAsync(clientA, own.Id, Expense(accountB.Id, categoriesA["groceries"].Id, 5m, _today));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await clientA.ListTransactionsAsync()).Items.Should().ContainSingle().Which.Account.Id.Should().Be(accountA.Id);
        (await clientB.ListAccountsAsync()).Single(a => a.Id == accountB.Id).Balance.Should().Be(0m);
    }

    [Fact]
    public async Task Delete_OtherUsersTransferRow_ReturnsNotFoundAndKeepsPair()
    {
        var (clientA, _, _) = await ArrangeUserAsync();
        var (clientB, accountB, _) = await ArrangeUserAsync();
        var savingsB = await clientB.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var foreign = await clientB.CreateTransferAsync(new TransferRequest(accountB.Id, savingsB.Id, 100m, _today, null));

        var response = await clientA.DeleteAsync($"{TransactionsUrl}/{foreign.Id}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var balancesB = (await clientB.ListAccountsAsync()).ToDictionary(a => a.Id, a => a.Balance);
        balancesB[accountB.Id].Should().Be(-100m);
        balancesB[savingsB.Id].Should().Be(100m);
    }

    [Fact]
    public async Task Bulk_OwnAndOtherUsersIds_ReturnsNotFoundAndChangesNothing()
    {
        var (clientA, accountA, categoriesA) = await ArrangeUserAsync();
        var (clientB, accountB, categoriesB) = await ArrangeUserAsync();
        var own = await clientA.CreateTransactionAsync(Expense(accountA.Id, categoriesA["groceries"].Id, 5m, _today));
        var foreign = await clientB.CreateTransactionAsync(Expense(accountB.Id, categoriesB["groceries"].Id, 7m, _today));

        var bulkDelete = await BulkAsync(clientA, BulkTransactionAction.Delete, [own.Id, foreign.Id], null);
        var bulkMove = await BulkAsync(
            clientA,
            BulkTransactionAction.Recategorize,
            [own.Id, foreign.Id],
            categoriesA["shopping"].Id);

        bulkDelete.StatusCode.Should().Be(HttpStatusCode.NotFound);
        bulkMove.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await clientA.ListTransactionsAsync()).Items.Should().ContainSingle()
            .Which.Category!.Id.Should().Be(categoriesA["groceries"].Id);
        (await clientB.ListTransactionsAsync()).Items.Should().ContainSingle()
            .Which.Category!.Id.Should().Be(categoriesB["groceries"].Id);
    }

    [Fact]
    public async Task Transfer_UpdateOwnPairIntoOtherUsersAccount_ReturnsNotFoundAndLeavesItUnchanged()
    {
        var (clientA, accountA, _) = await ArrangeUserAsync();
        var (clientB, accountB, _) = await ArrangeUserAsync();
        var savingsA = await clientA.CreateAccountResponseAsync("Savings", AccountType.Savings);
        var own = await clientA.CreateTransferAsync(new TransferRequest(accountA.Id, savingsA.Id, 100m, _today, null));

        var response = await clientA.PutAsJsonAsync(
            $"{TransfersUrl}/{own.Transfer!.TransferPairId}",
            new TransferRequest(accountA.Id, accountB.Id, 100m, _today, null),
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await clientA.ListAccountsAsync()).Single(a => a.Id == savingsA.Id).Balance.Should().Be(100m);
        (await clientB.ListAccountsAsync()).Single(a => a.Id == accountB.Id).Balance.Should().Be(0m);
    }

    private async Task<(HttpClient Client, AccountResponse Account, IReadOnlyDictionary<string, CategoryResponse> Categories)>
        ArrangeUserAsync(decimal initialBalance = 0m)
    {
        var client = await factory.CreateSignedInClientAsync();
        var account = await client.CreateAccountResponseAsync("Main card", initialBalance: initialBalance);
        var categories = await client.GetCategoriesAsync();
        return (client, account, categories);
    }

    private static TransactionRequest Expense(
        Guid accountId,
        Guid categoryId,
        decimal amount,
        DateOnly date,
        string? merchant = null) =>
        new(TransactionType.Expense, amount, date, accountId, categoryId, merchant, null);

    private static Task<HttpResponseMessage> PutTransactionAsync(HttpClient client, Guid id, TransactionRequest request) =>
        client.PutAsJsonAsync($"{TransactionsUrl}/{id}", request, ApiJson.Options, CancellationToken);

    private static Task<HttpResponseMessage> BulkAsync(
        HttpClient client,
        BulkTransactionAction action,
        IReadOnlyList<Guid> ids,
        Guid? categoryId) =>
        client.PostAsJsonAsync(
            $"{TransactionsUrl}/bulk",
            new BulkTransactionRequest(action, ids, categoryId),
            ApiJson.Options,
            CancellationToken);

    private static async Task AssertFieldErrorAsync(HttpResponseMessage response, string field, string expectedMessage)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }

    private static StringContent JsonContent(string json) => new(json, System.Text.Encoding.UTF8, "application/json");

    private static string Hash(char c) => new(c, 64);

    private async Task<int> CountTombstonesAsync(Guid accountId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.DeletedImportHashes.CountAsync(h => h.AccountId == accountId, CancellationToken);
    }

    /// <summary>Inserts an imported (CSV) expense with its batch straight into the database (imports come in Phase 4).</summary>
    private async Task<Transaction> SeedImportedAsync(
        Guid userId,
        Guid accountId,
        Guid categoryId,
        string merchant,
        string hash)
    {
        var batch = new ImportBatch
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = accountId,
            FileKey = $"imports/{userId}/{Guid.NewGuid()}.csv",
            BankFormat = BankFormat.MBank,
            Status = ImportBatchStatus.Done,
            CreatedAt = new DateTimeOffset(2026, 10, 20, 8, 0, 0, TimeSpan.Zero),
        };
        var transaction = NewRow(userId, accountId, categoryId, TransactionType.Expense, 12.34m, _today);
        transaction.Source = TransactionSource.Csv;
        transaction.Merchant = merchant;
        transaction.ExternalHash = hash;
        transaction.ImportBatchId = batch.Id;

        await SeedAsync(db =>
        {
            db.ImportBatches.Add(batch);
            db.Transactions.Add(transaction);
        });
        return transaction;
    }

    private async Task SeedAsync(Action<AppDbContext> seed)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        await db.SaveChangesAsync(CancellationToken);
    }

    private static Transaction NewRow(
        Guid userId,
        Guid accountId,
        Guid categoryId,
        TransactionType type,
        decimal amount,
        DateOnly date) =>
        new()
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            AccountId = accountId,
            CategoryId = categoryId,
            Type = type,
            Amount = amount,
            Date = date,
            Source = TransactionSource.Manual,
        };
}
