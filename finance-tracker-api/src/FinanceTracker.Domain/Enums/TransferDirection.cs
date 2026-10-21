namespace FinanceTracker.Domain.Enums;

/// <summary>
/// Side of a transfer pair. Set only on transactions of type <see cref="TransactionType.Transfer"/>.
/// </summary>
public enum TransferDirection
{
    Out,
    In,
}
