using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Transactions;
using FinanceTracker.Domain.Entities;
using FinanceTracker.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class TransactionRepository(AppDbContext dbContext) : ITransactionRepository
{
    /// <summary>Escape character for LIKE patterns built from user input.</summary>
    private const string _likeEscape = "\\";

    public async Task<TransactionPage> ListAsync(
        Guid userId,
        TransactionFilter filter,
        TransactionSort sort,
        long offset,
        int limit,
        CancellationToken cancellationToken)
    {
        var filtered = Filter(userId, filter);

        // Count and footer totals over the whole filtered set in one aggregate query. Transfers count as rows but
        // add no money. Income in an expense category is a refund: it lowers expenses instead of adding to income.
        var totals = await filtered
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Income = g.Sum(t => t.Type == TransactionType.Income && t.Category!.Type == CategoryType.Income
                    ? t.Amount
                    : 0m),
                Expenses = g.Sum(t => t.Type == TransactionType.Expense
                    ? t.Amount
                    : t.Type == TransactionType.Income && t.Category!.Type == CategoryType.Expense
                        ? -t.Amount
                        : 0m),
            })
            .SingleOrDefaultAsync(cancellationToken);

        var count = totals?.Count ?? 0;
        var income = totals?.Income ?? 0m;
        var expenses = totals?.Expenses ?? 0m;

        IReadOnlyList<TransactionResponse> items = [];
        if (offset < count)
        {
            var rows = await Order(ToRows(userId, filtered), sort)
                .Skip((int)offset)
                .Take(limit)
                .ToListAsync(cancellationToken);
            items = [.. rows.Select(ToResponse)];
        }

        return new TransactionPage(items, count, TransactionTotals.FromSums(income, expenses));
    }

    public async Task<TransactionResponse?> GetAsync(
        Guid userId,
        Guid transactionId,
        CancellationToken cancellationToken)
    {
        var row = await ToRows(userId, dbContext.Transactions.Where(t => t.UserId == userId && t.Id == transactionId))
            .SingleOrDefaultAsync(cancellationToken);
        return row is null ? null : ToResponse(row);
    }

    public async Task<TransactionResponse?> GetTransferAsync(
        Guid userId,
        Guid transferPairId,
        CancellationToken cancellationToken)
    {
        var outRows = dbContext.Transactions.Where(t =>
            t.UserId == userId
            && t.TransferPairId == transferPairId
            && t.TransferDirection == TransferDirection.Out);
        var row = await ToRows(userId, outRows).SingleOrDefaultAsync(cancellationToken);
        return row is null ? null : ToResponse(row);
    }

    public async Task<IReadOnlyList<MerchantSuggestion>> ListMerchantsAsync(
        Guid userId,
        string? search,
        int limit,
        CancellationToken cancellationToken)
    {
        var withMerchant = dbContext.Transactions.Where(t =>
            t.UserId == userId && t.Type != TransactionType.Transfer && t.Merchant != null);

        var prefixPattern = "";
        if (search is not null)
        {
            var escaped = EscapeLike(search);
            var containsPattern = "%" + escaped + "%";
            prefixPattern = escaped + "%";
            withMerchant = withMerchant.Where(t => EF.Functions.ILike(
                PostgresFunctions.Unaccent(t.Merchant)!,
                PostgresFunctions.Unaccent(containsPattern)!,
                _likeEscape));
        }

        // Grouped by lower(merchant) so "Lidl" and "LIDL" are one suggestion, shown in its most recent spelling.
        var merchants = await withMerchant
            .GroupBy(t => t.Merchant!.ToLower())
            .Select(g => new
            {
                Key = g.Key,
                Merchant = g.OrderByDescending(t => t.Date).ThenByDescending(t => t.Id).Select(t => t.Merchant!).First(),
                LastUsedOn = g.Max(t => t.Date),
                StartsWith = search != null
                    && EF.Functions.ILike(
                        PostgresFunctions.Unaccent(g.Key)!,
                        PostgresFunctions.Unaccent(prefixPattern)!,
                        _likeEscape),
            })
            .OrderByDescending(m => m.StartsWith)
            .ThenByDescending(m => m.LastUsedOn)
            .ThenBy(m => m.Key)
            .Take(limit)
            .ToListAsync(cancellationToken);

        if (merchants.Count == 0)
        {
            return [];
        }

        // Last-used active category per merchant: the newest transaction (date, then ID) of each merchant whose
        // category is still active. One query for the whole (small) page of merchants; the keys come from the
        // database's own lower(), so both queries group identically.
        var keys = merchants.Select(m => m.Key).ToList();
        var lastCategories = await dbContext.Transactions
            .Where(t => t.UserId == userId
                && t.Type != TransactionType.Transfer
                && t.Merchant != null
                && keys.Contains(t.Merchant.ToLower())
                && t.Category != null
                && !t.Category.IsArchived)
            .GroupBy(t => t.Merchant!.ToLower())
            .Select(g => g
                .OrderByDescending(t => t.Date)
                .ThenByDescending(t => t.Id)
                .Select(t => new
                {
                    Key = t.Merchant!.ToLower(),
                    Category = new TransactionCategory(
                        t.Category!.Id,
                        t.Category.Name,
                        t.Category.Type,
                        t.Category.Icon,
                        t.Category.Color,
                        t.Category.SystemKey,
                        t.Category.IsArchived),
                })
                .First())
            .ToDictionaryAsync(x => x.Key, x => x.Category, cancellationToken);

        return
        [
            .. merchants.Select(m => new MerchantSuggestion(
                m.Merchant,
                m.LastUsedOn,
                lastCategories.GetValueOrDefault(m.Key))),
        ];
    }

    public Task<Transaction?> FindAsync(Guid userId, Guid transactionId, CancellationToken cancellationToken) =>
        dbContext.Transactions.SingleOrDefaultAsync(t => t.UserId == userId && t.Id == transactionId, cancellationToken);

    public async Task<IReadOnlyList<Transaction>> FindTransferAsync(
        Guid userId,
        Guid transferPairId,
        CancellationToken cancellationToken) =>
        await dbContext.Transactions
            .Where(t => t.UserId == userId && t.TransferPairId == transferPairId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<TransactionHeader>> ListHeadersAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        CancellationToken cancellationToken) =>
        await dbContext.Transactions
            .Where(t => t.UserId == userId && transactionIds.Contains(t.Id))
            .Select(t => new TransactionHeader(t.Id, t.Type, t.TransferPairId, t.CategoryId, t.Date))
            .ToListAsync(cancellationToken);

    public async Task<int> DeleteAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        IReadOnlyCollection<Guid> transferPairIds,
        CancellationToken cancellationToken)
    {
        var ids = transactionIds.ToArray();
        var pairIds = transferPairIds.ToArray();

        // Tombstones first, from the rows about to go; an existing tombstone is kept as is.
        await dbContext.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO "DeletedImportHashes" ("AccountId", "ExternalHash")
            SELECT "AccountId", "ExternalHash" FROM "Transactions"
            WHERE "UserId" = {userId}
              AND "ExternalHash" IS NOT NULL
              AND ("Id" = ANY({ids}) OR "TransferPairId" = ANY({pairIds}))
            ON CONFLICT DO NOTHING
            """,
            cancellationToken);

        return await dbContext.Transactions
            .Where(t => t.UserId == userId
                && (ids.Contains(t.Id) || (t.TransferPairId != null && pairIds.Contains(t.TransferPairId.Value))))
            .ExecuteDeleteAsync(cancellationToken);
    }

    public Task<int> RecategorizeAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        Guid categoryId,
        CancellationToken cancellationToken) =>
        dbContext.Transactions
            .Where(t => t.UserId == userId && transactionIds.Contains(t.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CategoryId, categoryId), cancellationToken);

    public void Add(params Transaction[] transactions) => dbContext.Transactions.AddRange(transactions);

    /// <summary>
    /// The user's table rows matching the filters. A transfer is represented by its Out row only; with an account
    /// filter it matches when either side is in that account.
    /// </summary>
    private IQueryable<Transaction> Filter(Guid userId, TransactionFilter filter)
    {
        var query = dbContext.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.TransferDirection != TransferDirection.In);

        if (filter.From is { } from)
        {
            query = query.Where(t => t.Date >= from);
        }

        if (filter.To is { } to)
        {
            query = query.Where(t => t.Date <= to);
        }

        if (filter.AccountId is { } accountId)
        {
            query = query.Where(t => t.AccountId == accountId
                || (t.TransferPairId != null
                    && dbContext.Transactions.Any(other => other.UserId == userId
                        && other.TransferPairId == t.TransferPairId
                        && other.AccountId == accountId)));
        }

        if (filter.CategoryIds.Count > 0)
        {
            var categoryIds = filter.CategoryIds.ToArray();
            query = query.Where(t => t.CategoryId != null && categoryIds.Contains(t.CategoryId.Value));
        }

        if (filter.Type is { } type)
        {
            query = query.Where(t => t.Type == type);
        }

        if (filter.MinAmount is { } minAmount)
        {
            query = query.Where(t => t.Amount >= minAmount);
        }

        if (filter.MaxAmount is { } maxAmount)
        {
            query = query.Where(t => t.Amount <= maxAmount);
        }

        if (filter.Search is { } search)
        {
            // f_unaccent(column) ILIKE f_unaccent('%query%'), served by the trigram indexes on the same expressions.
            var pattern = "%" + EscapeLike(search) + "%";
            query = query.Where(t =>
                EF.Functions.ILike(PostgresFunctions.Unaccent(t.Merchant)!, PostgresFunctions.Unaccent(pattern)!, _likeEscape)
                || EF.Functions.ILike(PostgresFunctions.Unaccent(t.Note)!, PostgresFunctions.Unaccent(pattern)!, _likeEscape));
        }

        return query;
    }

    /// <summary>
    /// Flat projection of table rows; a transfer's In side (destination account) is joined in. An equi-join on the
    /// pair ID: In rows always have one and plain transactions have none, so only an Out row finds a match (a plain
    /// LEFT JOIN, without EF's IS NULL compensation for comparing two nullable columns).
    /// </summary>
    private IQueryable<TransactionRow> ToRows(Guid userId, IQueryable<Transaction> transactions) =>
        from t in transactions
        join inRow in dbContext.Transactions.Where(i =>
                i.UserId == userId && i.TransferDirection == TransferDirection.In)
            on t.TransferPairId equals inRow.TransferPairId into inRows
        from destination in inRows.DefaultIfEmpty()
        select new TransactionRow
        {
            Id = t.Id,
            Type = t.Type,
            Amount = t.Amount,
            Date = t.Date,
            Merchant = t.Merchant,
            Note = t.Note,
            Source = t.Source,
            AccountId = t.AccountId,
            AccountName = t.Account.Name,
            AccountIsArchived = t.Account.IsArchived,
            CategoryId = t.CategoryId,
            CategoryName = t.Category != null ? t.Category.Name : null,
            CategoryType = t.Category != null ? t.Category.Type : null,
            CategoryIcon = t.Category != null ? t.Category.Icon : null,
            CategoryColor = t.Category != null ? t.Category.Color : null,
            CategorySystemKey = t.Category != null ? t.Category.SystemKey : null,
            CategoryIsArchived = t.Category != null && t.Category.IsArchived,
            TransferPairId = t.TransferPairId,
            ToAccountId = destination != null ? destination.AccountId : null,
            ToAccountName = destination != null ? destination.Account.Name : null,
            ToAccountIsArchived = destination != null && destination.Account.IsArchived,
            ImportBatchId = t.ImportBatchId,
            ImportedAt = t.ImportBatch != null ? t.ImportBatch.CreatedAt : null,
        };

    /// <summary>
    /// Allow-listed ordering; ties are broken by ID in the same direction so paging is deterministic. Merchant,
    /// category and account sort case-insensitively; rows without a value go last.
    /// </summary>
    private static IQueryable<TransactionRow> Order(IQueryable<TransactionRow> rows, TransactionSort sort)
    {
        var descending = sort.Descending;
        IOrderedQueryable<TransactionRow> ordered = sort.Field switch
        {
            TransactionSortField.Amount => OrderBy(rows, r => r.Amount, descending),
            TransactionSortField.Merchant => OrderBy(
                rows.OrderBy(r => r.Merchant == null),
                r => r.Merchant!.ToLower(),
                descending),
            TransactionSortField.Category => OrderBy(
                rows.OrderBy(r => r.CategoryName == null),
                r => r.CategoryName!.ToLower(),
                descending),
            TransactionSortField.Account => OrderBy(rows, r => r.AccountName.ToLower(), descending),
            _ => OrderBy(rows, r => r.Date, descending),
        };

        return descending ? ordered.ThenByDescending(r => r.Id) : ordered.ThenBy(r => r.Id);
    }

    private static IOrderedQueryable<TransactionRow> OrderBy<TKey>(
        IQueryable<TransactionRow> rows,
        System.Linq.Expressions.Expression<Func<TransactionRow, TKey>> key,
        bool descending) =>
        descending ? rows.OrderByDescending(key) : rows.OrderBy(key);

    private static IOrderedQueryable<TransactionRow> OrderBy<TKey>(
        IOrderedQueryable<TransactionRow> rows,
        System.Linq.Expressions.Expression<Func<TransactionRow, TKey>> key,
        bool descending) =>
        descending ? rows.ThenByDescending(key) : rows.ThenBy(key);

    private static TransactionResponse ToResponse(TransactionRow row)
    {
        var account = new TransactionAccount(row.AccountId, row.AccountName, row.AccountIsArchived);

        var category = row.CategoryId is { } categoryId
            ? new TransactionCategory(
                categoryId,
                row.CategoryName!,
                row.CategoryType!.Value,
                row.CategoryIcon!,
                row.CategoryColor!,
                row.CategorySystemKey,
                row.CategoryIsArchived)
            : null;

        var transfer = row.TransferPairId is { } pairId && row.ToAccountId is { } toAccountId
            ? new TransferInfo(
                pairId,
                account,
                new TransactionAccount(toAccountId, row.ToAccountName!, row.ToAccountIsArchived))
            : null;

        var import = row.ImportBatchId is { } batchId && row.ImportedAt is { } importedAt
            ? new TransactionImportInfo(batchId, importedAt)
            : null;

        var needsCategory = row.Source != TransactionSource.Manual && Category.IsFallbackKey(row.CategorySystemKey);

        return new TransactionResponse(
            row.Id,
            row.Type,
            row.Amount,
            row.Date,
            row.Merchant,
            row.Note,
            row.Source,
            account,
            category,
            transfer,
            import,
            needsCategory);
    }

    /// <summary>Makes user input match literally inside a LIKE pattern.</summary>
    private static string EscapeLike(string text) =>
        text.Replace(_likeEscape, _likeEscape + _likeEscape, StringComparison.Ordinal)
            .Replace("%", _likeEscape + "%", StringComparison.Ordinal)
            .Replace("_", _likeEscape + "_", StringComparison.Ordinal);

    /// <summary>Flat row read by the list queries, mapped to <see cref="TransactionResponse"/> in memory.</summary>
    private sealed class TransactionRow
    {
        public Guid Id { get; init; }

        public TransactionType Type { get; init; }

        public decimal Amount { get; init; }

        public DateOnly Date { get; init; }

        public string? Merchant { get; init; }

        public string? Note { get; init; }

        public TransactionSource Source { get; init; }

        public Guid AccountId { get; init; }

        public string AccountName { get; init; } = "";

        public bool AccountIsArchived { get; init; }

        public Guid? CategoryId { get; init; }

        public string? CategoryName { get; init; }

        public CategoryType? CategoryType { get; init; }

        public string? CategoryIcon { get; init; }

        public string? CategoryColor { get; init; }

        public string? CategorySystemKey { get; init; }

        public bool CategoryIsArchived { get; init; }

        public Guid? TransferPairId { get; init; }

        public Guid? ToAccountId { get; init; }

        public string? ToAccountName { get; init; }

        public bool ToAccountIsArchived { get; init; }

        public Guid? ImportBatchId { get; init; }

        public DateTimeOffset? ImportedAt { get; init; }
    }
}
