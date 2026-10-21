using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Domain.Entities;

/// <summary>
/// A single money movement on an account. <see cref="Amount"/> is always positive;
/// <see cref="Type"/> and <see cref="TransferDirection"/> decide its sign.
/// A transfer is stored as two rows (Out and In) sharing a <see cref="TransferPairId"/>.
/// </summary>
public sealed class Transaction
{
    public const int MerchantMaxLength = 200;
    public const int NoteMaxLength = 500;
    public const int ExternalHashLength = 64;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid AccountId { get; set; }

    public Account Account { get; set; } = null!;

    /// <summary>Null for transfers.</summary>
    public Guid? CategoryId { get; set; }

    public Category? Category { get; set; }

    public TransactionType Type { get; set; }

    /// <summary>Set only when <see cref="Type"/> is <see cref="TransactionType.Transfer"/>.</summary>
    public TransferDirection? TransferDirection { get; set; }

    public decimal Amount { get; set; }

    public DateOnly Date { get; set; }

    public string? Merchant { get; set; }

    public string? Note { get; set; }

    public TransactionSource Source { get; set; }

    /// <summary>Lowercase hex SHA-256 of the imported row; null for manual transactions.</summary>
    public string? ExternalHash { get; set; }

    public Guid? ImportBatchId { get; set; }

    public ImportBatch? ImportBatch { get; set; }

    /// <summary>Shared by both rows of a transfer; null for other transaction types.</summary>
    public Guid? TransferPairId { get; set; }
}
