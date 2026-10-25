using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;

namespace FinanceTracker.Application.Me;

/// <summary>The signed-in user's profile and onboarding state.</summary>
public sealed record MeResponse(Guid Id, string Email, string DisplayName, DateTimeOffset? OnboardingCompletedAt);

public sealed class MeService(IUserAccounts users, IAccountRepository accounts, TimeProvider timeProvider)
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

    /// <summary>Onboarding step 1 (at least one account) is required before onboarding can finish.</summary>
    public static readonly Error NoActiveAccount = Error.Conflict(
        "No account yet",
        "Add at least one account first.");

    /// <summary>
    /// Marks onboarding as done. Idempotent: the first completion time is kept. Requires an active account;
    /// once one exists the user can't go back to zero (the last active account can't be archived).
    /// </summary>
    public async Task<Result> CompleteOnboardingAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (await accounts.CountActiveAsync(userId, cancellationToken) == 0)
        {
            // A deleted user has no accounts either; report that as an expired session, not a missing account.
            return await users.GetProfileAsync(userId, cancellationToken) is null ? UserNotFound : NoActiveAccount;
        }

        var exists = await users.CompleteOnboardingAsync(userId, timeProvider.GetUtcNow(), cancellationToken);
        return exists ? Result.Success() : UserNotFound;
    }
}
