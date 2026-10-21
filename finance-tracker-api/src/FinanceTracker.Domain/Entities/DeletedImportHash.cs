namespace FinanceTracker.Domain.Entities;

/// <summary>
/// Tombstone written when a user deletes an imported transaction, so re-importing the same
/// statement doesn't restore it.
/// </summary>
public sealed class DeletedImportHash
{
    public Guid AccountId { get; set; }

    public Account Account { get; set; } = null!;

    public required string ExternalHash { get; set; }
}
