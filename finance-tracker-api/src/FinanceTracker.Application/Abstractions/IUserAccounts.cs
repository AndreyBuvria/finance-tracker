using FinanceTracker.Application.Me;

namespace FinanceTracker.Application.Abstractions;

/// <summary>Identity-backed user accounts (password hashing and storage live in Infrastructure).</summary>
public interface IUserAccounts
{
    /// <summary>
    /// Creates the user with <c>UserName = Email</c>. A duplicate email, including one inserted by a
    /// concurrent registration, is reported as <see cref="CreateUserFailure.DuplicateEmail"/>.
    /// </summary>
    Task<CreateUserResult> CreateAsync(NewUser user, string password, CancellationToken cancellationToken);

    /// <summary>Returns the user ID when the email exists and the password matches; otherwise null.</summary>
    Task<Guid?> FindIdByCredentialsAsync(string email, string password, CancellationToken cancellationToken);

    Task<MeResponse?> GetProfileAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Sets <c>OnboardingCompletedAt</c> to <paramref name="completedAt"/> unless it is already set.
    /// Returns false when the user doesn't exist.
    /// </summary>
    Task<bool> CompleteOnboardingAsync(Guid userId, DateTimeOffset completedAt, CancellationToken cancellationToken);
}

public sealed record NewUser(string DisplayName, string Email, DateTimeOffset CreatedAt);

public enum CreateUserFailure
{
    None,
    DuplicateEmail,
    InvalidEmail,
    InvalidPassword,
}

public sealed record CreateUserResult(Guid UserId, CreateUserFailure Failure)
{
    public bool Succeeded => Failure == CreateUserFailure.None;

    public static CreateUserResult Created(Guid userId) => new(userId, CreateUserFailure.None);

    public static CreateUserResult Failed(CreateUserFailure failure) => new(Guid.Empty, failure);
}
