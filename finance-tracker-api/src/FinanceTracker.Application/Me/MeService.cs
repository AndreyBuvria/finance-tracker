using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;

namespace FinanceTracker.Application.Me;

/// <summary>The signed-in user's profile and onboarding state.</summary>
public sealed record MeResponse(Guid Id, string Email, string DisplayName, DateTimeOffset? OnboardingCompletedAt);

public sealed class MeService(IUserAccounts users, TimeProvider timeProvider)
{
    /// <summary>The token is valid but its user no longer exists (e.g. the account was deleted).</summary>
    public static readonly Error UserNotFound = Error.Unauthorized(
        "Session expired",
        "Your session has expired. Log in again.");

    public async Task<Result<MeResponse>> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        var profile = await users.GetProfileAsync(userId, cancellationToken);
        return profile is null ? UserNotFound : profile;
    }

    /// <summary>Marks onboarding as done. Idempotent: the first completion time is kept.</summary>
    public async Task<Result> CompleteOnboardingAsync(Guid userId, CancellationToken cancellationToken)
    {
        var exists = await users.CompleteOnboardingAsync(userId, timeProvider.GetUtcNow(), cancellationToken);
        return exists ? Result.Success() : UserNotFound;
    }
}
