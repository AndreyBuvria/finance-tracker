using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>One CSV statement upload and its processing state.</summary>
public sealed class ImportBatch
{
    public const int FileKeyMaxLength = 300;
    public const int ErrorMaxLength = 2000;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid AccountId { get; set; }

    public Account Account { get; set; } = null!;

    /// <summary>S3 object key, <c>imports/{userId}/{batchId}.csv</c>.</summary>
    public required string FileKey { get; set; }

    public BankFormat BankFormat { get; set; }

    public ImportBatchStatus Status { get; set; }

    public int RowsTotal { get; set; }

    public int RowsImported { get; set; }

    public int RowsSkipped { get; set; }

    /// <summary>Safe, user-facing failure summary; null unless the batch failed.</summary>
    public string? Error { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
