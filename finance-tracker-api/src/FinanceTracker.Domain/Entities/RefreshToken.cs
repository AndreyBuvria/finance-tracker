namespace FinanceTracker.Domain.Entities;

/// <summary>
/// Refresh token issued to a user. Only the SHA-256 hash of the raw token is stored.
/// Tokens are rotated on every refresh; presenting a revoked token revokes the whole chain.
/// </summary>
public sealed class RefreshToken
{
    public const int TokenHashLength = 64;

    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>Lowercase hex SHA-256 of the raw token.</summary>
    public required string TokenHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>The token that replaced this one during rotation.</summary>
    public Guid? ReplacedByTokenId { get; set; }

    public bool IsRevoked => RevokedAt is not null;

    public bool IsExpired(DateTimeOffset now) => ExpiresAt <= now;
}
