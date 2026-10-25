using FinanceTracker.Application.Abstractions;
using FinanceTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class RefreshTokenRepository(AppDbContext dbContext) : IRefreshTokenRepository
{
    public void Add(RefreshToken token) => dbContext.RefreshTokens.Add(token);

    public Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken) =>
        dbContext.RefreshTokens
            .AsNoTracking()
            .SingleOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

    public Task<RefreshToken?> FindByIdAsync(Guid tokenId, CancellationToken cancellationToken) =>
        dbContext.RefreshTokens
            .AsNoTracking()
            .SingleOrDefaultAsync(t => t.Id == tokenId, cancellationToken);

    public Task LockUserTokensAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Transaction-scoped advisory lock keyed by the user: released automatically on commit/rollback,
        // shared by every API instance, and it doesn't block writes to the user's row. A hash collision
        // with another user only serializes two unrelated refreshes briefly.
        var lockKey = $"refresh-tokens:{userId}";
        return dbContext.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
            cancellationToken);
    }

    public async Task<bool> TryRevokeAsync(
        Guid tokenId,
        DateTimeOffset revokedAt,
        Guid? replacedByTokenId,
        CancellationToken cancellationToken)
    {
        // The RevokedAt IS NULL condition makes concurrent revocations of the same token mutually exclusive.
        var updated = await dbContext.RefreshTokens
            .Where(t => t.Id == tokenId && t.RevokedAt == null)
            .ExecuteUpdateAsync(
                s => s
                    .SetProperty(t => t.RevokedAt, revokedAt)
                    .SetProperty(t => t.ReplacedByTokenId, replacedByTokenId),
                cancellationToken);

        return updated == 1;
    }

    public Task RevokeDescendantsAsync(Guid tokenId, DateTimeOffset revokedAt, CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlAsync(
            $"""
            WITH RECURSIVE chain ("Id") AS (
                SELECT "ReplacedByTokenId" FROM "RefreshTokens"
                WHERE "Id" = {tokenId} AND "ReplacedByTokenId" IS NOT NULL
                UNION
                SELECT t."ReplacedByTokenId" FROM "RefreshTokens" t
                JOIN chain c ON t."Id" = c."Id"
                WHERE t."ReplacedByTokenId" IS NOT NULL
            )
            UPDATE "RefreshTokens" SET "RevokedAt" = {revokedAt}
            WHERE "Id" IN (SELECT "Id" FROM chain) AND "RevokedAt" IS NULL
            """,
            cancellationToken);
}
