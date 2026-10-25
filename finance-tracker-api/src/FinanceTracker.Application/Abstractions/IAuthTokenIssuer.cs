namespace FinanceTracker.Application.Abstractions;

/// <summary>Issues signed access tokens, derives rotated refresh tokens and exposes the token settings.</summary>
public interface IAuthTokenIssuer
{
    TimeSpan AccessTokenLifetime { get; }

    TimeSpan RefreshTokenLifetime { get; }

    /// <summary>How long a just-rotated refresh token is still accepted as a benign concurrent refresh.</summary>
    TimeSpan RefreshTokenReuseGraceWindow { get; }

    /// <summary>Creates a signed access token for the user, valid from <paramref name="issuedAt"/>.</summary>
    string IssueAccessToken(Guid userId, DateTimeOffset issuedAt);

    /// <summary>
    /// The raw refresh token that replaces <paramref name="refreshToken"/> on rotation. It is a keyed
    /// (server-secret) function of the presented token, so it is unpredictable without the secret, yet
    /// the same successor can be re-derived when the same token is presented again within the grace window.
    /// </summary>
    string DeriveSuccessorRefreshToken(string refreshToken);
}
