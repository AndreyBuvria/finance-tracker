namespace FinanceTracker.Application.Abstractions;

/// <summary>Saves pending changes and groups several writes into one database transaction.</summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Starts a database transaction. Disposing it without <see cref="IUnitOfWorkTransaction.CommitAsync"/>
    /// rolls everything back.
    /// </summary>
    Task<IUnitOfWorkTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
}

public interface IUnitOfWorkTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}
