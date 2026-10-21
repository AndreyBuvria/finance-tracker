using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Application.Abstractions;

public interface IRefreshTokenRepository
{
    /// <summary>Stages a new token; it is written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void Add(RefreshToken token);

    /// <summary>Finds a token by its hash (read-only, not tracked).</summary>
    Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>
    /// Revokes the token only if it is still unrevoked, optionally linking its replacement.
    /// Returns false when another request revoked it first.
    /// </summary>
    Task<bool> TryRevokeAsync(
        Guid tokenId,
        DateTimeOffset revokedAt,
        Guid? replacedByTokenId,
        CancellationToken cancellationToken);

    /// <summary>Revokes every still-active token that descends from <paramref name="tokenId"/> through rotation.</summary>
    Task RevokeDescendantsAsync(Guid tokenId, DateTimeOffset revokedAt, CancellationToken cancellationToken);
}
