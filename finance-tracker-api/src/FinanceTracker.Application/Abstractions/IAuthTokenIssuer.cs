namespace FinanceTracker.Application.Abstractions;

/// <summary>Issues signed access tokens and exposes the configured token lifetimes.</summary>
public interface IAuthTokenIssuer
{
    TimeSpan AccessTokenLifetime { get; }

    TimeSpan RefreshTokenLifetime { get; }

    /// <summary>Creates a signed access token for the user, valid from <paramref name="issuedAt"/>.</summary>
    string IssueAccessToken(Guid userId, DateTimeOffset issuedAt);
}
