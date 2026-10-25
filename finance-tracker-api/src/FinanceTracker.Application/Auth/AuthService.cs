using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Auth;

/// <summary>Registration, login and the refresh-token lifecycle (rotation and reuse detection).</summary>
public sealed partial class AuthService(
    IUserAccounts users,
    ICategoryRepository categories,
    IRefreshTokenRepository refreshTokens,
    IUnitOfWork unitOfWork,
    IAuthTokenIssuer tokenIssuer,
    TimeProvider timeProvider,
    IValidator<RegisterRequest> registerValidator,
    IValidator<LoginRequest> loginValidator,
    IValidator<LogoutRequest> logoutValidator,
    ILogger<AuthService> logger)
{
    /// <summary>Upper bound on rotations followed for one grace-window replay.</summary>
    private const int _maxGraceChainSteps = 5;

    public static readonly Error DuplicateEmail = Error.Conflict(
        "Email already registered",
        "An account with this email already exists. Log in instead?");

    public static readonly Error InvalidCredentials = Error.Unauthorized(
        "Login failed",
        "Email or password is incorrect.");

    public static readonly Error SessionExpired = Error.Unauthorized(
        "Session expired",
        "Your session has expired. Log in again.");

    /// <summary>Creates the user, seeds the default categories and signs the user in, all in one transaction.</summary>
    public async Task<Result<AuthTokens>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var validation = await registerValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var now = timeProvider.GetUtcNow();
        var newUser = new NewUser(request.DisplayName.Trim(), request.Email.Trim(), now);

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);

        var created = await users.CreateAsync(newUser, request.Password, cancellationToken);
        if (!created.Succeeded)
        {
            return created.Failure switch
            {
                CreateUserFailure.DuplicateEmail => DuplicateEmail,
                CreateUserFailure.InvalidPassword => Error.Validation(
                    nameof(RegisterRequest.Password),
                    AuthRules.PasswordNeedsLetterAndNumber),
                _ => Error.Validation(nameof(RegisterRequest.Email), AuthRules.EmailInvalid),
            };
        }

        categories.AddRange(DefaultCategories.CreateFor(created.UserId));
        var tokens = StageNewTokens(created.UserId, now, out _);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        LogRegistered(created.UserId);
        return tokens;
    }

    public async Task<Result<AuthTokens>> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var validation = await loginValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var userId = await users.FindIdByCredentialsAsync(request.Email.Trim(), request.Password, cancellationToken);
        if (userId is null)
        {
            return InvalidCredentials;
        }

        var tokens = StageNewTokens(userId.Value, timeProvider.GetUtcNow(), out _);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return tokens;
    }

    /// <summary>
    /// Exchanges an active refresh token for a new token pair and revokes the old one (rotation).
    /// <para>
    /// Grace window: a token rotated less than <see cref="IAuthTokenIssuer.RefreshTokenReuseGraceWindow"/>
    /// ago is a benign concurrent refresh (two tabs, a retried request). Its successor is derived from the
    /// presented token (<see cref="IAuthTokenIssuer.DeriveSuccessorRefreshToken"/>), so instead of forking
    /// the chain the request gets a fresh access token plus the chain's current refresh token; every caller
    /// ends up with the same, still valid token. The window is measured from the original rotation time,
    /// so repeated replays don't extend it.
    /// </para>
    /// <para>
    /// Any other revoked token (logged out, revoked by reuse detection, or rotated longer ago than the
    /// window) is treated as theft: every token rotated from it is revoked too.
    /// </para>
    /// <para>
    /// All decisions run under a per-user database lock and re-read the token after taking it, so rotation
    /// and reuse revocation never interleave: a rotation can't slip a new token past a concurrent reuse
    /// revocation of the same chain, and a reuse-revoked chain can't be rotated afterwards.
    /// </para>
    /// </summary>
    public async Task<Result<AuthTokens>> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return SessionExpired;
        }

        var tokenHash = RefreshTokenCodec.Hash(request.RefreshToken);

        // Unknown tokens are rejected before any lock is taken.
        var candidate = await refreshTokens.FindByHashAsync(tokenHash, cancellationToken);
        if (candidate is null)
        {
            return SessionExpired;
        }

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await refreshTokens.LockUserTokensAsync(candidate.UserId, cancellationToken);

        // Re-read under the lock: a concurrent refresh may have rotated or revoked it meanwhile.
        var stored = await refreshTokens.FindByHashAsync(tokenHash, cancellationToken);
        if (stored is null)
        {
            return SessionExpired;
        }

        var now = timeProvider.GetUtcNow();

        if (!stored.IsRevoked)
        {
            return stored.IsExpired(now)
                ? SessionExpired
                : await RotateAsync(stored, request.RefreshToken, now, transaction, cancellationToken);
        }

        var successor = await FindGraceSuccessorAsync(stored, request.RefreshToken, now, cancellationToken);
        if (successor is not null)
        {
            // Nothing was written; the chain is unchanged.
            await transaction.CommitAsync(cancellationToken);
            LogGraceRefresh(stored.UserId, stored.Id);
            return IssueTokens(stored.UserId, now, successor);
        }

        await refreshTokens.RevokeDescendantsAsync(stored.Id, now, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        LogTokenReuse(stored.UserId, stored.Id);
        return SessionExpired;
    }

    /// <summary>
    /// Revokes the caller's refresh token. Unknown, foreign or already revoked tokens are ignored, except a
    /// token rotated within the grace window: it could still be replayed for the chain's current token, so
    /// that token (and anything rotated from it) is revoked too. Runs under the same per-user lock as
    /// refresh, so a concurrent refresh can't leave an active token behind in the logged-out chain.
    /// </summary>
    public async Task<Result> LogoutAsync(Guid userId, LogoutRequest request, CancellationToken cancellationToken)
    {
        var validation = await logoutValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var tokenHash = RefreshTokenCodec.Hash(request.RefreshToken);
        var candidate = await refreshTokens.FindByHashAsync(tokenHash, cancellationToken);
        if (candidate is null || candidate.UserId != userId)
        {
            return Result.Success();
        }

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await refreshTokens.LockUserTokensAsync(userId, cancellationToken);

        var stored = await refreshTokens.FindByHashAsync(tokenHash, cancellationToken);
        if (stored is null)
        {
            return Result.Success();
        }

        var now = timeProvider.GetUtcNow();
        if (!stored.IsRevoked)
        {
            await refreshTokens.TryRevokeAsync(stored.Id, now, null, cancellationToken);
        }
        else if (stored is { ReplacedByTokenId: not null, RevokedAt: { } rotatedAt }
            && now - rotatedAt < tokenIssuer.RefreshTokenReuseGraceWindow)
        {
            await refreshTokens.RevokeDescendantsAsync(stored.Id, now, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return Result.Success();
    }

    private async Task<Result<AuthTokens>> RotateAsync(
        RefreshToken stored,
        string rawToken,
        DateTimeOffset now,
        IUnitOfWorkTransaction transaction,
        CancellationToken cancellationToken)
    {
        var tokens = StageNewTokens(
            stored.UserId,
            now,
            tokenIssuer.DeriveSuccessorRefreshToken(rawToken),
            out var newTokenId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Refresh and logout both hold the per-user lock, so nothing should have revoked the token since it
        // was re-read. The conditional revoke is a last guard: if it did happen, no new pair is issued and
        // the staged token is rolled back with the transaction.
        if (!await refreshTokens.TryRevokeAsync(stored.Id, now, newTokenId, cancellationToken))
        {
            return SessionExpired;
        }

        await transaction.CommitAsync(cancellationToken);
        return tokens;
    }

    /// <summary>
    /// Follows the rotation chain from a revoked token while each step was a rotation inside the grace
    /// window and returns the raw value of the active token at its end, or null when the replay is not
    /// benign (logged out, reuse-revoked, rotated too long ago, expired, or not derived by this server).
    /// </summary>
    private async Task<string?> FindGraceSuccessorAsync(
        RefreshToken revoked,
        string rawToken,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var graceWindow = tokenIssuer.RefreshTokenReuseGraceWindow;
        var current = revoked;
        var currentRaw = rawToken;

        for (var step = 0; step < _maxGraceChainSteps; step++)
        {
            if (current.RevokedAt is not { } revokedAt)
            {
                return current.IsExpired(now) ? null : currentRaw;
            }

            // ReplacedByTokenId is set only by rotation; logout and reuse revocation leave it empty.
            if (current.ReplacedByTokenId is not { } nextId || now - revokedAt >= graceWindow)
            {
                return null;
            }

            var nextRaw = tokenIssuer.DeriveSuccessorRefreshToken(currentRaw);
            var next = await refreshTokens.FindByIdAsync(nextId, cancellationToken);
            if (next is null || next.TokenHash != RefreshTokenCodec.Hash(nextRaw))
            {
                return null;
            }

            current = next;
            currentRaw = nextRaw;
        }

        return null;
    }

    private AuthTokens StageNewTokens(Guid userId, DateTimeOffset now, out Guid refreshTokenId) =>
        StageNewTokens(userId, now, RefreshTokenCodec.Generate(), out refreshTokenId);

    private AuthTokens StageNewTokens(Guid userId, DateTimeOffset now, string rawRefreshToken, out Guid refreshTokenId)
    {
        var refreshToken = new RefreshToken
        {
            Id = Guid.CreateVersion7(now),
            UserId = userId,
            TokenHash = RefreshTokenCodec.Hash(rawRefreshToken),
            CreatedAt = now,
            ExpiresAt = now + tokenIssuer.RefreshTokenLifetime,
        };
        refreshTokens.Add(refreshToken);
        refreshTokenId = refreshToken.Id;

        return IssueTokens(userId, now, rawRefreshToken);
    }

    private AuthTokens IssueTokens(Guid userId, DateTimeOffset now, string rawRefreshToken) =>
        new(
            tokenIssuer.IssueAccessToken(userId, now),
            (int)tokenIssuer.AccessTokenLifetime.TotalSeconds,
            rawRefreshToken);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} registered")]
    private partial void LogRegistered(Guid userId);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Revoked refresh token {TokenId} of user {UserId} was presented again; revoked its rotation chain")]
    private partial void LogTokenReuse(Guid userId, Guid tokenId);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Refresh token {TokenId} of user {UserId} was replayed within the reuse grace window")]
    private partial void LogGraceRefresh(Guid userId, Guid tokenId);
}
