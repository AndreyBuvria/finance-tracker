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
    /// Exchanges an active refresh token for a new token pair and revokes the old one. Presenting a
    /// token that was already revoked is treated as theft: every token rotated from it is revoked too.
    /// </summary>
    public async Task<Result<AuthTokens>> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return SessionExpired;
        }

        var stored = await refreshTokens.FindByHashAsync(RefreshTokenCodec.Hash(request.RefreshToken), cancellationToken);
        if (stored is null)
        {
            return SessionExpired;
        }

        var now = timeProvider.GetUtcNow();

        if (stored.IsRevoked)
        {
            await refreshTokens.RevokeDescendantsAsync(stored.Id, now, cancellationToken);
            LogTokenReuse(stored.UserId, stored.Id);
            return SessionExpired;
        }

        if (stored.IsExpired(now))
        {
            return SessionExpired;
        }

        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);

        var tokens = StageNewTokens(stored.UserId, now, out var newTokenId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // A concurrent refresh with the same token won the race; this request must not get a second pair.
        if (!await refreshTokens.TryRevokeAsync(stored.Id, now, newTokenId, cancellationToken))
        {
            return SessionExpired;
        }

        await transaction.CommitAsync(cancellationToken);
        return tokens;
    }

    /// <summary>Revokes the caller's refresh token. Unknown, foreign or already revoked tokens are ignored.</summary>
    public async Task<Result> LogoutAsync(Guid userId, LogoutRequest request, CancellationToken cancellationToken)
    {
        var validation = await logoutValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var stored = await refreshTokens.FindByHashAsync(RefreshTokenCodec.Hash(request.RefreshToken), cancellationToken);
        if (stored is { IsRevoked: false } && stored.UserId == userId)
        {
            await refreshTokens.TryRevokeAsync(stored.Id, timeProvider.GetUtcNow(), null, cancellationToken);
        }

        return Result.Success();
    }

    private AuthTokens StageNewTokens(Guid userId, DateTimeOffset now, out Guid refreshTokenId)
    {
        var rawRefreshToken = RefreshTokenCodec.Generate();
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

        return new AuthTokens(
            tokenIssuer.IssueAccessToken(userId, now),
            (int)tokenIssuer.AccessTokenLifetime.TotalSeconds,
            rawRefreshToken);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} registered")]
    private partial void LogRegistered(Guid userId);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Revoked refresh token {TokenId} of user {UserId} was presented again; revoked its rotation chain")]
    private partial void LogTokenReuse(Guid userId, Guid tokenId);
}
