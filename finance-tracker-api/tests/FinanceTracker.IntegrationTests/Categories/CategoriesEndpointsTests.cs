using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Me;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.IntegrationTests.Categories;

public sealed class CategoriesEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string _categoriesUrl = "/api/categories";

    /// <summary>The fake clock's date (see <see cref="ApiFactory.Time"/>); the class never advances it.</summary>
    private static readonly DateOnly _today = new(2026, 10, 21);

    private static readonly DateOnly _october = new(2026, 10, 1);
    private static readonly DateOnly _november = new(2026, 11, 1);

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    [Fact]
    public async Task List_NewUser_ReturnsSeededDefaultsInAgreedShape()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.GetAsync(_categoriesUrl, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CancellationToken));
        var first = json.RootElement.GetProperty("items")[0];
        first.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(
        [
            "id", "name", "type", "icon", "color", "systemKey", "isArchived", "isProtected", "transactionCount",
            "budgetCount",
        ]);

        var items = (await ListAsync(client)).Items;
        items.Select(c => c.Name).Should().Equal(
            "Eating out",
            "Entertainment",
            "Groceries",
            "Health",
            "Housing",
            "Other",
            "Shopping",
            "Subscriptions",
            "Transport",
            "Utilities",
            "Other income",
            "Salary");
        items.Single(c => c.SystemKey == "groceries").Should().BeEquivalentTo(new
        {
            Name = "Groceries",
            Type = CategoryType.Expense,
            Icon = "shopping_cart",
            Color = "#2e7d32",
            IsArchived = false,
            IsProtected = false,
            TransactionCount = 0,
            BudgetCount = 0,
        });
        items.Where(c => c.IsProtected).Select(c => c.SystemKey).Should().BeEquivalentTo(["other", "other_income"]);
    }

    [Fact]
    public async Task List_TypeFilter_ReturnsOnlyThatType()
    {
        using var client = await CreateSignedInClientAsync();

        var items = (await ListAsync(client, type: "Income")).Items;

        items.Select(c => c.SystemKey).Should().Equal("other_income", "salary");
    }

    [Theory]
    [InlineData("", "Transfer")]
    [InlineData("", "5")]
    [InlineData("/top", "Transfer")]
    [InlineData("/top", "0")]
    public async Task List_UnknownType_ReturnsFriendlyTypeFieldError(string path, string type)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.GetAsync($"{_categoriesUrl}{path}?type={type}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("type").WhoseValue.Should().Equal("Choose a category type.");
    }

    [Fact]
    public async Task List_TypeInAnyCaseAndEmptyType_AreAccepted()
    {
        using var client = await CreateSignedInClientAsync();

        var income = await ListTopAsync(client, "?type=income&limit=50");
        var all = (await client.GetFromJsonAsync<CategoryListResponse>(
            $"{_categoriesUrl}?type=",
            ApiJson.Options,
            CancellationToken))!;

        income.Items.Should().HaveCount(2);
        all.Items.Should().HaveCount(12);
    }

    [Fact]
    public async Task List_IncludeArchived_ReturnsArchivedAfterActive()
    {
        using var client = await CreateSignedInClientAsync();
        var shopping = await GetBySystemKeyAsync(client, "shopping");
        (await ArchiveAsync(client, shopping.Id)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var active = (await ListAsync(client)).Items;
        var all = (await ListAsync(client, includeArchived: true)).Items;

        active.Should().NotContain(c => c.Id == shopping.Id);
        all.Should().HaveCount(12);
        all[^1].Should().BeEquivalentTo(new { shopping.Id, IsArchived = true });
    }

    [Fact]
    public async Task List_WithTransactionsAndBudgets_ReturnsUsageCounts()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var groceries = await GetBySystemKeyAsync(client, "groceries");
        await SeedAsync(db =>
        {
            db.Transactions.AddRange(
                Expense(userId, accountId, groceries.Id, 10m, _today),
                Expense(userId, accountId, groceries.Id, 20m, new DateOnly(2025, 1, 5)));
            db.Budgets.AddRange(
                NewBudget(userId, groceries.Id, _october, 500m),
                NewBudget(userId, groceries.Id, _november, 400m));
        });

        var listed = (await ListAsync(client)).Items.Single(c => c.Id == groceries.Id);

        listed.TransactionCount.Should().Be(2);
        listed.BudgetCount.Should().Be(2);
    }

    [Fact]
    public async Task Create_ValidRequest_ReturnsCreatedCategoryWithTrimmedNameAndLowercaseColor()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsJsonAsync(
            _categoriesUrl,
            new { name = "  Dog  ", type = "Expense", icon = "pets", color = "#C62828" },
            ApiJson.Options,
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
        var created = await response.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken);
        created.Should().BeEquivalentTo(new
        {
            Name = "Dog",
            Type = CategoryType.Expense,
            Icon = "pets",
            Color = "#c62828",
            SystemKey = (string?)null,
            IsArchived = false,
            IsProtected = false,
            TransactionCount = 0,
            BudgetCount = 0,
        });
        (await ListAsync(client)).Items.Should().ContainSingle(c => c.Id == created!.Id);
    }

    [Theory]
    [InlineData("""{ "name": " ", "type": "Expense", "icon": "pets", "color": "#c62828" }""", "name", "Enter a category name.")]
    [InlineData("""{ "type": "Expense", "icon": "pets", "color": "#c62828" }""", "name", "Enter a category name.")]
    [InlineData(
        """{ "name": "1234567890123456789012345678901", "type": "Expense", "icon": "pets", "color": "#c62828" }""",
        "name",
        "Name can be at most 30 characters.")]
    [InlineData("""{ "name": "Dog", "icon": "pets", "color": "#c62828" }""", "type", "Choose a category type.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "color": "#c62828" }""", "icon", "Choose an icon.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "icon": "rocket", "color": "#c62828" }""", "icon", "Choose an icon.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "icon": "PETS", "color": "#c62828" }""", "icon", "Choose an icon.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "icon": "pets" }""", "color", "Choose a color.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "icon": "pets", "color": "#123456" }""", "color", "Choose a color.")]
    [InlineData("""{ "name": "Dog", "type": "Expense", "icon": "pets", "color": "red" }""", "color", "Choose a color.")]
    public async Task Create_InvalidField_ReturnsValidationProblem(string body, string field, string expectedMessage)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(_categoriesUrl, JsonContent(body), CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey(field).WhoseValue.Should().Equal(expectedMessage);
    }

    [Theory]
    [InlineData("\"Transfer\"")]
    [InlineData("1")]
    [InlineData("null")]
    [InlineData("[]")]
    public async Task Create_UnknownCategoryType_ReturnsTypeFieldError(string typeJson)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.PostAsync(
            _categoriesUrl,
            JsonContent($$"""{ "name": "Dog", "type": {{typeJson}}, "icon": "pets", "color": "#c62828" }"""),
            CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().BeEquivalentTo(new Dictionary<string, string[]>
        {
            ["type"] = ["Choose a category type."],
        });
    }

    [Fact]
    public async Task Create_DuplicateActiveNameOfSameTypeInDifferentCase_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await PostCategoryAsync(client, "GROCERIES", CategoryType.Expense);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("A category with this name already exists.");
    }

    [Fact]
    public async Task Create_SameNameWithOtherType_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await PostCategoryAsync(client, "Groceries", CategoryType.Income);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Create_NameOfArchivedCategory_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var shopping = await GetBySystemKeyAsync(client, "shopping");
        await ArchiveAsync(client, shopping.Id);

        var response = await PostCategoryAsync(client, "shopping", CategoryType.Expense);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Create_ConcurrentRequestsWithSameName_ExactlyOneSucceeds()
    {
        using var client = await CreateSignedInClientAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(i =>
            PostCategoryAsync(client, i % 2 == 0 ? "Coffee" : "coffee", CategoryType.Expense)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).Should().Be(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).Should().Be(4);
    }

    [Fact]
    public async Task Update_RenameAndRestyleDefault_KeepsSystemKey()
    {
        using var client = await CreateSignedInClientAsync();
        var groceries = await GetBySystemKeyAsync(client, "groceries");

        var response = await PutCategoryAsync(
            client,
            groceries.Id,
            new CategoryRequest(" Food ", CategoryType.Expense, "bakery_dining", "#EF6C00"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken);
        updated.Should().BeEquivalentTo(groceries with { Name = "Food", Icon = "bakery_dining", Color = "#ef6c00" });
    }

    [Fact]
    public async Task Update_TypeOfDefault_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var shopping = await GetBySystemKeyAsync(client, "shopping");

        var response = await PutCategoryAsync(
            client,
            shopping.Id,
            new CategoryRequest("Shopping", CategoryType.Income, "shopping_bag", "#ad1457"));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("The type of a default category can't be changed.");
    }

    [Fact]
    public async Task Update_TypeOfUnusedCustomCategory_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var gifts = await CreateCategoryAsync(client, "Gifts", CategoryType.Expense);

        var response = await PutCategoryAsync(
            client,
            gifts.Id,
            new CategoryRequest("Gifts", CategoryType.Income, "card_giftcard", "#c62828"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken);
        updated!.Type.Should().Be(CategoryType.Income);
    }

    [Fact]
    public async Task Update_TypeOfCustomCategoryWithTransactions_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var gifts = await CreateCategoryAsync(client, "Gifts", CategoryType.Expense);
        await SeedAsync(db => db.Transactions.Add(Expense(userId, accountId, gifts.Id, 15m, _today)));

        var response = await PutCategoryAsync(
            client,
            gifts.Id,
            new CategoryRequest("Gifts", CategoryType.Income, "card_giftcard", "#c62828"));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category is already in use, so its type can't be changed.");
    }

    [Fact]
    public async Task Update_NameOfAnotherActiveCategory_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var gifts = await CreateCategoryAsync(client, "Gifts", CategoryType.Expense);

        var response = await PutCategoryAsync(
            client,
            gifts.Id,
            new CategoryRequest("eating OUT", CategoryType.Expense, "card_giftcard", "#c62828"));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("A category with this name already exists.");
    }

    [Fact]
    public async Task Update_InvalidColor_ReturnsValidationProblem()
    {
        using var client = await CreateSignedInClientAsync();
        var groceries = await GetBySystemKeyAsync(client, "groceries");

        var response = await PutCategoryAsync(
            client,
            groceries.Id,
            new CategoryRequest("Groceries", CategoryType.Expense, "shopping_cart", "#000000"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("color").WhoseValue.Should().Equal("Choose a color.");
    }

    [Fact]
    public async Task Archive_DefaultCategory_HidesItAndKeepsTransactions()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var health = await GetBySystemKeyAsync(client, "health");
        await SeedAsync(db => db.Transactions.Add(Expense(userId, accountId, health.Id, 80m, _today)));

        var response = await ArchiveAsync(client, health.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ListAsync(client)).Items.Should().NotContain(c => c.Id == health.Id);
        (await ListAsync(client, includeArchived: true)).Items.Should()
            .ContainSingle(c => c.Id == health.Id)
            .Which.Should().BeEquivalentTo(new { IsArchived = true, TransactionCount = 1, SystemKey = "health" });
    }

    [Fact]
    public async Task Archive_AlreadyArchived_ReturnsNoContent()
    {
        using var client = await CreateSignedInClientAsync();
        var health = await GetBySystemKeyAsync(client, "health");
        await ArchiveAsync(client, health.Id);

        var response = await ArchiveAsync(client, health.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Theory]
    [InlineData("other")]
    [InlineData("other_income")]
    public async Task Archive_FallbackCategory_ReturnsConflict(string systemKey)
    {
        using var client = await CreateSignedInClientAsync();
        var fallback = await GetBySystemKeyAsync(client, systemKey);

        var response = await ArchiveAsync(client, fallback.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category can't be hidden. It collects transactions that don't fit anywhere else.");
        (await ListAsync(client)).Items.Should().Contain(c => c.Id == fallback.Id);
    }

    [Fact]
    public async Task Restore_ArchivedCategory_ShowsItAgain()
    {
        using var client = await CreateSignedInClientAsync();
        var health = await GetBySystemKeyAsync(client, "health");
        await ArchiveAsync(client, health.Id);

        var response = await RestoreAsync(client, health.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ListAsync(client)).Items.Should().ContainSingle(c => c.Id == health.Id && !c.IsArchived);
    }

    [Fact]
    public async Task Restore_ActiveCategory_ReturnsNoContent()
    {
        using var client = await CreateSignedInClientAsync();
        var health = await GetBySystemKeyAsync(client, "health");

        var response = await RestoreAsync(client, health.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Restore_NameTakenByActiveCategory_ReturnsConflictUntilRenamed()
    {
        using var client = await CreateSignedInClientAsync();
        var shopping = await GetBySystemKeyAsync(client, "shopping");
        await ArchiveAsync(client, shopping.Id);
        await CreateCategoryAsync(client, "SHOPPING", CategoryType.Expense);

        var conflict = await RestoreAsync(client, shopping.Id);

        conflict.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await conflict.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("A category with this name already exists. Rename it first.");

        // Renaming the archived category is allowed and resolves the clash.
        var rename = await PutCategoryAsync(
            client,
            shopping.Id,
            new CategoryRequest("Old shopping", CategoryType.Expense, "shopping_bag", "#ad1457"));
        rename.StatusCode.Should().Be(HttpStatusCode.OK);
        (await rename.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken))!
            .IsArchived.Should().BeTrue();
        (await RestoreAsync(client, shopping.Id)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_CustomCategoryWithoutTransactions_DeletesItWithBudgetsRulesAndAlerts()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var dog = await CreateCategoryAsync(client, "Dog", CategoryType.Expense);
        await SeedAsync(db =>
        {
            db.Budgets.Add(NewBudget(userId, dog.Id, _october, 100m));
            db.CategoryRules.Add(NewRule(userId, dog.Id, "ZOOPLUS"));
            db.Alerts.Add(NewAlert(userId, dog.Id, _october, AlertLevel.Warning));
        });

        var response = await DeleteAsync(client, dog.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Categories.AnyAsync(c => c.Id == dog.Id, CancellationToken)).Should().BeFalse();
        (await db.Budgets.AnyAsync(b => b.CategoryId == dog.Id, CancellationToken)).Should().BeFalse();
        (await db.CategoryRules.AnyAsync(r => r.CategoryId == dog.Id, CancellationToken)).Should().BeFalse();
        (await db.Alerts.AnyAsync(a => a.CategoryId == dog.Id, CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task Delete_ArchivedCustomCategoryWithoutTransactions_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var dog = await CreateCategoryAsync(client, "Dog", CategoryType.Expense);
        await ArchiveAsync(client, dog.Id);

        var response = await DeleteAsync(client, dog.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ListAsync(client, includeArchived: true)).Items.Should().NotContain(c => c.Id == dog.Id);
    }

    [Fact]
    public async Task Delete_CustomCategoryWithTransactions_ReturnsConflictAndKeepsIt()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var dog = await CreateCategoryAsync(client, "Dog", CategoryType.Expense);
        await SeedAsync(db => db.Transactions.Add(Expense(userId, accountId, dog.Id, 45m, _today)));

        var response = await DeleteAsync(client, dog.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be(
            "This category has transactions. Archive it or merge it into another category instead.");
        (await ListAsync(client)).Items.Should().Contain(c => c.Id == dog.Id);
    }

    [Fact]
    public async Task Delete_DefaultCategory_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var housing = await GetBySystemKeyAsync(client, "housing");

        var response = await DeleteAsync(client, housing.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("Default categories can't be deleted. Hide them instead.");
    }

    [Fact]
    public async Task Delete_FallbackCategory_ReturnsConflict()
    {
        using var client = await CreateSignedInClientAsync();
        var other = await GetBySystemKeyAsync(client, "other");

        var response = await DeleteAsync(client, other.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category can't be deleted. It collects transactions that don't fit anywhere else.");
    }

    [Fact]
    public async Task Merge_CustomIntoDefault_MovesTransactionsBudgetsAndRulesThenArchivesSource()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var eatingOut = await GetBySystemKeyAsync(client, "eating_out");
        await SeedAsync(db =>
        {
            db.Transactions.AddRange(
                Expense(userId, accountId, coffee.Id, 12.50m, _today),
                Expense(userId, accountId, coffee.Id, 14m, new DateOnly(2026, 9, 3)),
                Income(userId, accountId, coffee.Id, 5m, _today),
                Expense(userId, accountId, eatingOut.Id, 60m, _today));
            db.Budgets.AddRange(
                NewBudget(userId, coffee.Id, _october, 50m),
                NewBudget(userId, coffee.Id, _november, 30.25m),
                NewBudget(userId, eatingOut.Id, _october, 200m));
            db.CategoryRules.Add(NewRule(userId, coffee.Id, "STARBUCKS"));
            db.Alerts.AddRange(
                NewAlert(userId, coffee.Id, _october, AlertLevel.Over),
                NewAlert(userId, eatingOut.Id, _october, AlertLevel.Warning));
        });

        var response = await MergeAsync(client, coffee.Id, eatingOut.Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var merge = await response.Content.ReadFromJsonAsync<MergeCategoryResponse>(ApiJson.Options, CancellationToken);
        merge!.TransactionsMoved.Should().Be(3);
        merge.BudgetsMoved.Should().Be(2);
        merge.RulesMoved.Should().Be(1);
        merge.Target.Should().BeEquivalentTo(new { eatingOut.Id, TransactionCount = 4, BudgetCount = 2, IsArchived = false });

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Categories.SingleAsync(c => c.Id == coffee.Id, CancellationToken)).IsArchived.Should().BeTrue();
        (await db.Transactions.CountAsync(t => t.CategoryId == coffee.Id, CancellationToken)).Should().Be(0);
        (await db.Transactions.CountAsync(t => t.CategoryId == eatingOut.Id, CancellationToken)).Should().Be(4);

        var budgets = await db.Budgets
            .Where(b => b.UserId == userId)
            .Select(b => new { b.CategoryId, b.Month, b.LimitAmount })
            .ToListAsync(CancellationToken);
        budgets.Should().BeEquivalentTo(
        [
            new { CategoryId = eatingOut.Id, Month = _october, LimitAmount = 250m },
            new { CategoryId = eatingOut.Id, Month = _november, LimitAmount = 30.25m },
        ]);

        (await db.CategoryRules.SingleAsync(r => r.UserId == userId, CancellationToken))
            .CategoryId.Should().Be(eatingOut.Id);

        var alerts = await db.Alerts
            .Where(a => a.UserId == userId)
            .Select(a => new { a.CategoryId, a.Level })
            .ToListAsync(CancellationToken);
        alerts.Should().BeEquivalentTo([new { CategoryId = eatingOut.Id, Level = AlertLevel.Warning }]);
    }

    [Fact]
    public async Task Merge_SameMonthBudgetsSumAboveMaxAmount_ReturnsConflictAndMovesNothing()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var eatingOut = await GetBySystemKeyAsync(client, "eating_out");
        await SeedAsync(db =>
        {
            db.Transactions.Add(Expense(userId, accountId, coffee.Id, 12.50m, _today));
            db.Budgets.AddRange(
                NewBudget(userId, coffee.Id, _october, 5_000_000_000_000_000m),
                NewBudget(userId, eatingOut.Id, _october, 5_000_000_000_000_000m));
        });

        var response = await MergeAsync(client, coffee.Id, eatingOut.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("Merging would make a monthly budget too large. Lower one of the limits first.");
        var source = (await ListAsync(client)).Items.Single(c => c.Id == coffee.Id);
        source.Should().BeEquivalentTo(new { IsArchived = false, TransactionCount = 1, BudgetCount = 1 });
    }

    [Fact]
    public async Task Merge_SameMonthBudgetsSumExactlyMaxAmount_Succeeds()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var eatingOut = await GetBySystemKeyAsync(client, "eating_out");
        await SeedAsync(db => db.Budgets.AddRange(
            NewBudget(userId, coffee.Id, _october, 0.99m),
            NewBudget(userId, eatingOut.Id, _october, 9_999_999_999_999_999m)));

        var response = await MergeAsync(client, coffee.Id, eatingOut.Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Merge_DefaultIntoOther_ArchivesTheDefault()
    {
        using var client = await CreateSignedInClientAsync();
        var entertainment = await GetBySystemKeyAsync(client, "entertainment");
        var other = await GetBySystemKeyAsync(client, "other");

        var response = await MergeAsync(client, entertainment.Id, other.Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ListAsync(client, includeArchived: true)).Items
            .Single(c => c.Id == entertainment.Id).IsArchived.Should().BeTrue();
    }

    [Fact]
    public async Task Merge_ArchivedSource_MovesItsHistory()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var eatingOut = await GetBySystemKeyAsync(client, "eating_out");
        await SeedAsync(db => db.Transactions.Add(Expense(userId, accountId, coffee.Id, 9m, _today)));
        await ArchiveAsync(client, coffee.Id);

        var response = await MergeAsync(client, coffee.Id, eatingOut.Id);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<MergeCategoryResponse>(ApiJson.Options, CancellationToken))!
            .TransactionsMoved.Should().Be(1);
    }

    [Theory]
    [InlineData("other")]
    [InlineData("other_income")]
    public async Task Merge_FallbackSource_ReturnsConflict(string systemKey)
    {
        using var client = await CreateSignedInClientAsync();
        var fallback = await GetBySystemKeyAsync(client, systemKey);
        var target = await CreateCategoryAsync(client, "Misc", fallback.Type);

        var response = await MergeAsync(client, fallback.Id, target.Id);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category can't be merged. It collects transactions that don't fit anywhere else.");
        (await ListAsync(client)).Items.Should().Contain(c => c.Id == fallback.Id);
    }

    [Fact]
    public async Task Merge_IntoItself_ReturnsTargetFieldError()
    {
        using var client = await CreateSignedInClientAsync();
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);

        var response = await MergeAsync(client, coffee.Id, coffee.Id);

        await AssertTargetFieldErrorAsync(response, "Choose a different category.");
    }

    [Fact]
    public async Task Merge_IntoArchivedCategory_ReturnsTargetFieldError()
    {
        using var client = await CreateSignedInClientAsync();
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var health = await GetBySystemKeyAsync(client, "health");
        await ArchiveAsync(client, health.Id);

        var response = await MergeAsync(client, coffee.Id, health.Id);

        await AssertTargetFieldErrorAsync(response, "Choose an active category.");
    }

    [Fact]
    public async Task Merge_IntoCategoryOfOtherType_ReturnsTargetFieldError()
    {
        using var client = await CreateSignedInClientAsync();
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);
        var salary = await GetBySystemKeyAsync(client, "salary");

        var response = await MergeAsync(client, coffee.Id, salary.Id);

        await AssertTargetFieldErrorAsync(response, "Choose a category of the same type.");
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{ "targetCategoryId": null }""")]
    [InlineData("""{ "targetCategoryId": "00000000-0000-0000-0000-000000000000" }""")]
    public async Task Merge_MissingTarget_ReturnsTargetFieldError(string body)
    {
        using var client = await CreateSignedInClientAsync();
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);

        var response = await client.PostAsync($"{_categoriesUrl}/{coffee.Id}/merge", JsonContent(body), CancellationToken);

        await AssertTargetFieldErrorAsync(response, "Choose a category to merge into.");
    }

    [Fact]
    public async Task Merge_UnknownTarget_ReturnsNotFound()
    {
        using var client = await CreateSignedInClientAsync();
        var coffee = await CreateCategoryAsync(client, "Coffee", CategoryType.Expense);

        var response = await MergeAsync(client, coffee.Id, Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(client)).Items.Should().Contain(c => c.Id == coffee.Id);
    }

    [Fact]
    public async Task ListTop_NewUser_ReturnsDefaultsInSeededOrder()
    {
        using var client = await CreateSignedInClientAsync();

        var top = await ListTopAsync(client, "");

        top.Items.Select(c => c.SystemKey).Should().Equal(
            "groceries",
            "eating_out",
            "transport",
            "housing",
            "utilities",
            "health",
            "shopping",
            "entertainment");
    }

    [Fact]
    public async Task ListTop_WithUsage_OrdersByUseWithinLast90DaysThenDefaults()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var categories = (await ListAsync(client)).Items.ToDictionary(c => c.SystemKey ?? c.Name, c => c.Id);
        var dog = await CreateCategoryAsync(client, "Dog", CategoryType.Expense);

        // 90-day window ending today (21 Oct 2026) starts on 24 Jul 2026.
        var firstDayInWindow = _today.AddDays(-89);
        var lastDayBeforeWindow = _today.AddDays(-90);
        await SeedAsync(db =>
        {
            db.Transactions.AddRange(Enumerable.Range(0, 3)
                .Select(_ => Expense(userId, accountId, categories["transport"], 5m, _today)));
            db.Transactions.AddRange(Enumerable.Range(0, 2)
                .Select(_ => Expense(userId, accountId, dog.Id, 5m, firstDayInWindow)));
            db.Transactions.AddRange(Enumerable.Range(0, 9)
                .Select(_ => Expense(userId, accountId, categories["shopping"], 5m, lastDayBeforeWindow)));
            db.Transactions.Add(Income(userId, accountId, categories["salary"], 7500m, _today));
        });

        var expenseTop = await ListTopAsync(client, "?limit=4&type=Expense");
        var allTop = await ListTopAsync(client, "?limit=3");

        expenseTop.Items.Select(c => c.Id).Should().Equal(
            categories["transport"],
            dog.Id,
            categories["groceries"],
            categories["eating_out"]);
        allTop.Items.Select(c => c.Id).Should().Equal(categories["transport"], dog.Id, categories["salary"]);
    }

    [Fact]
    public async Task ListTop_ArchivedCategory_IsExcluded()
    {
        using var client = await CreateSignedInClientAsync();
        var userId = await GetUserIdAsync(client);
        var accountId = await CreateAccountAsync(client);
        var transport = await GetBySystemKeyAsync(client, "transport");
        await SeedAsync(db => db.Transactions.Add(Expense(userId, accountId, transport.Id, 5m, _today)));
        await ArchiveAsync(client, transport.Id);

        var top = await ListTopAsync(client, "?limit=50");

        top.Items.Should().HaveCount(11).And.NotContain(c => c.Id == transport.Id);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("51")]
    public async Task ListTop_LimitOutOfRange_ReturnsValidationProblem(string limit)
    {
        using var client = await CreateSignedInClientAsync();

        var response = await client.GetAsync($"{_categoriesUrl}/top?limit={limit}", CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("limit").WhoseValue.Should().Equal("Limit must be between 1 and 50.");
    }

    [Fact]
    public async Task List_WithoutAccessToken_ReturnsUnauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync(_categoriesUrl, CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Update_UnknownCategoryId_ReturnsNotFound()
    {
        using var client = await CreateSignedInClientAsync();

        var response = await PutCategoryAsync(
            client,
            Guid.NewGuid(),
            new CategoryRequest("Dog", CategoryType.Expense, "pets", "#c62828"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        problem!.Detail.Should().Be("This category doesn't exist.");
    }

    // User isolation: another user's category behaves as if it doesn't exist.

    [Fact]
    public async Task List_TwoUsers_EachSeesOnlyOwnCategoriesAndCounts()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var userB = await GetUserIdAsync(clientB);
        var accountB = await CreateAccountAsync(clientB);
        var dogB = await CreateCategoryAsync(clientB, "Dog", CategoryType.Expense);
        var groceriesB = await GetBySystemKeyAsync(clientB, "groceries");
        await SeedAsync(db => db.Transactions.Add(Expense(userB, accountB, groceriesB.Id, 5m, _today)));

        var listA = (await ListAsync(clientA, includeArchived: true)).Items;
        var topA = (await ListTopAsync(clientA, "?limit=50")).Items;

        listA.Should().HaveCount(12).And.NotContain(c => c.Id == dogB.Id || c.Id == groceriesB.Id);
        listA.Should().OnlyContain(c => c.TransactionCount == 0);
        topA.Should().NotContain(c => c.Id == dogB.Id || c.Id == groceriesB.Id);
        topA.Select(c => c.SystemKey).Take(1).Should().Equal("groceries");
    }

    [Fact]
    public async Task Update_OtherUsersCategory_ReturnsNotFoundAndLeavesItUnchanged()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var dogB = await CreateCategoryAsync(clientB, "Dog", CategoryType.Expense);

        var response = await PutCategoryAsync(
            clientA,
            dogB.Id,
            new CategoryRequest("Hacked", CategoryType.Expense, "pets", "#c62828"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Single(c => c.Id == dogB.Id).Should().BeEquivalentTo(dogB);
    }

    [Fact]
    public async Task Delete_OtherUsersCategory_ReturnsNotFoundAndKeepsIt()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var dogB = await CreateCategoryAsync(clientB, "Dog", CategoryType.Expense);

        var response = await DeleteAsync(clientA, dogB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Should().Contain(c => c.Id == dogB.Id);
    }

    [Fact]
    public async Task Archive_OtherUsersCategory_ReturnsNotFoundAndLeavesItActive()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var healthB = await GetBySystemKeyAsync(clientB, "health");

        var response = await ArchiveAsync(clientA, healthB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Should().Contain(c => c.Id == healthB.Id);
    }

    [Fact]
    public async Task Restore_OtherUsersArchivedCategory_ReturnsNotFoundAndLeavesItArchived()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var healthB = await GetBySystemKeyAsync(clientB, "health");
        await ArchiveAsync(clientB, healthB.Id);

        var response = await RestoreAsync(clientA, healthB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB, includeArchived: true)).Items
            .Single(c => c.Id == healthB.Id).IsArchived.Should().BeTrue();
    }

    [Fact]
    public async Task Merge_OtherUsersSource_ReturnsNotFoundAndMovesNothing()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var userB = await GetUserIdAsync(clientB);
        var accountB = await CreateAccountAsync(clientB);
        var dogB = await CreateCategoryAsync(clientB, "Dog", CategoryType.Expense);
        await SeedAsync(db => db.Transactions.Add(Expense(userB, accountB, dogB.Id, 5m, _today)));
        var otherA = await GetBySystemKeyAsync(clientA, "other");

        var response = await MergeAsync(clientA, dogB.Id, otherA.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientB)).Items.Single(c => c.Id == dogB.Id)
            .Should().BeEquivalentTo(new { IsArchived = false, TransactionCount = 1 });
    }

    [Fact]
    public async Task Merge_OtherUsersTarget_ReturnsNotFoundAndMovesNothing()
    {
        using var clientA = await CreateSignedInClientAsync();
        using var clientB = await CreateSignedInClientAsync();
        var userA = await GetUserIdAsync(clientA);
        var accountA = await CreateAccountAsync(clientA);
        var coffeeA = await CreateCategoryAsync(clientA, "Coffee", CategoryType.Expense);
        await SeedAsync(db => db.Transactions.Add(Expense(userA, accountA, coffeeA.Id, 5m, _today)));
        var eatingOutB = await GetBySystemKeyAsync(clientB, "eating_out");

        var response = await MergeAsync(clientA, coffeeA.Id, eatingOutB.Id);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ListAsync(clientA)).Items.Single(c => c.Id == coffeeA.Id)
            .Should().BeEquivalentTo(new { IsArchived = false, TransactionCount = 1 });
        (await ListAsync(clientB)).Items.Single(c => c.Id == eatingOutB.Id).TransactionCount.Should().Be(0);
    }

    private static async Task AssertTargetFieldErrorAsync(HttpResponseMessage response, string expectedMessage)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(CancellationToken);
        problem!.Errors.Should().ContainKey("targetCategoryId").WhoseValue.Should().Equal(expectedMessage);
    }

    private async Task<HttpClient> CreateSignedInClientAsync()
    {
        using var anonymous = factory.CreateClient();
        var user = await anonymous.RegisterUserAsync();
        return factory.CreateClientWithToken(user.Tokens.AccessToken);
    }

    private static async Task<Guid> GetUserIdAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/me", CancellationToken))!.Id;

    private static async Task<Guid> CreateAccountAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/accounts",
            new AccountRequest("Main card", AccountType.Card, null, null),
            ApiJson.Options,
            CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<AccountResponse>(ApiJson.Options, CancellationToken))!.Id;
    }

    private static async Task<CategoryListResponse> ListAsync(
        HttpClient client,
        bool includeArchived = false,
        string? type = null)
    {
        var url = $"{_categoriesUrl}?includeArchived={includeArchived.ToString().ToLowerInvariant()}";
        if (type is not null)
        {
            url += $"&type={type}";
        }

        return (await client.GetFromJsonAsync<CategoryListResponse>(url, ApiJson.Options, CancellationToken))!;
    }

    private static async Task<CategoryListResponse> ListTopAsync(HttpClient client, string query) =>
        (await client.GetFromJsonAsync<CategoryListResponse>(
            $"{_categoriesUrl}/top{query}",
            ApiJson.Options,
            CancellationToken))!;

    private static async Task<CategoryResponse> GetBySystemKeyAsync(HttpClient client, string systemKey) =>
        (await ListAsync(client, includeArchived: true)).Items.Single(c => c.SystemKey == systemKey);

    private static Task<HttpResponseMessage> PostCategoryAsync(HttpClient client, string name, CategoryType type) =>
        client.PostAsJsonAsync(
            _categoriesUrl,
            new CategoryRequest(name, type, "category", "#546e7a"),
            ApiJson.Options,
            CancellationToken);

    private static async Task<CategoryResponse> CreateCategoryAsync(HttpClient client, string name, CategoryType type)
    {
        var response = await PostCategoryAsync(client, name, type);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<CategoryResponse>(ApiJson.Options, CancellationToken))!;
    }

    private static Task<HttpResponseMessage> PutCategoryAsync(HttpClient client, Guid id, CategoryRequest request) =>
        client.PutAsJsonAsync($"{_categoriesUrl}/{id}", request, ApiJson.Options, CancellationToken);

    private static Task<HttpResponseMessage> DeleteAsync(HttpClient client, Guid id) =>
        client.DeleteAsync($"{_categoriesUrl}/{id}", CancellationToken);

    private static Task<HttpResponseMessage> ArchiveAsync(HttpClient client, Guid id) =>
        client.PostAsync($"{_categoriesUrl}/{id}/archive", null, CancellationToken);

    private static Task<HttpResponseMessage> RestoreAsync(HttpClient client, Guid id) =>
        client.PostAsync($"{_categoriesUrl}/{id}/restore", null, CancellationToken);

    private static Task<HttpResponseMessage> MergeAsync(HttpClient client, Guid sourceId, Guid targetId) =>
        client.PostAsJsonAsync(
            $"{_categoriesUrl}/{sourceId}/merge",
            new MergeCategoryRequest(targetId),
            ApiJson.Options,
            CancellationToken);

    private static StringContent JsonContent(string json) => new(json, System.Text.Encoding.UTF8, "application/json");

    /// <summary>
    /// Inserts rows straight into the database (the transactions, budgets, rules and alerts endpoints come in
    /// later tasks).
    /// </summary>
    private async Task SeedAsync(Action<AppDbContext> seed)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        await db.SaveChangesAsync(CancellationToken);
    }

    private static Transaction Expense(Guid userId, Guid accountId, Guid categoryId, decimal amount, DateOnly date) =>
        NewTransaction(userId, accountId, categoryId, TransactionType.Expense, amount, date);

    private static Transaction Income(Guid userId, Guid accountId, Guid categoryId, decimal amount, DateOnly date) =>
        NewTransaction(userId, accountId, categoryId, TransactionType.Income, amount, date);

    private static Transaction NewTransaction(
        Guid userId,
        Guid accountId,
        Guid categoryId,
        TransactionType type,
        decimal amount,
        DateOnly date) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AccountId = accountId,
            CategoryId = categoryId,
            Type = type,
            Amount = amount,
            Date = date,
            Source = TransactionSource.Manual,
        };

    private static Budget NewBudget(Guid userId, Guid categoryId, DateOnly month, decimal limit) =>
        new() { Id = Guid.NewGuid(), UserId = userId, CategoryId = categoryId, Month = month, LimitAmount = limit };

    private static CategoryRule NewRule(Guid userId, Guid categoryId, string pattern) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CategoryId = categoryId,
            Pattern = pattern,
            MatchType = RuleMatchType.Contains,
            Priority = 1,
        };

    private static Alert NewAlert(Guid userId, Guid categoryId, DateOnly month, AlertLevel level) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CategoryId = categoryId,
            Month = month,
            Level = level,
            Percent = level == AlertLevel.Over ? 110 : 85,
            Amount = 15m,
            DaysLeft = 12,
            CreatedAt = new DateTimeOffset(2026, 10, 20, 12, 0, 0, TimeSpan.Zero),
        };
}
