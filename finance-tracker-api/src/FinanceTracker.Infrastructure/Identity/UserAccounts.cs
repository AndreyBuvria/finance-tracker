using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Me;
using FinanceTracker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FinanceTracker.Infrastructure.Identity;

internal sealed class UserAccounts(UserManager<User> userManager, AppDbContext dbContext) : IUserAccounts
{
    /// <summary>Identity's unique index on <c>NormalizedUserName</c>; UserName = Email, so it guards email uniqueness.</summary>
    private const string _userNameIndex = "UserNameIndex";

    public async Task<CreateUserResult> CreateAsync(NewUser newUser, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = new User
        {
            Id = Guid.CreateVersion7(newUser.CreatedAt),
            DisplayName = newUser.DisplayName,
            Email = newUser.Email,
            UserName = newUser.Email,
            CreatedAt = newUser.CreatedAt,
        };

        IdentityResult result;
        try
        {
            // UserManager has no per-call CancellationToken; it saves through the shared scoped DbContext.
            result = await userManager.CreateAsync(user, password);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, _userNameIndex))
        {
            // A concurrent registration with the same email passed Identity's pre-check first.
            dbContext.Entry(user).State = EntityState.Detached;
            return CreateUserResult.Failed(CreateUserFailure.DuplicateEmail);
        }

        if (result.Succeeded)
        {
            return CreateUserResult.Created(user.Id);
        }

        var codes = result.Errors.Select(e => e.Code).ToList();
        var describer = userManager.ErrorDescriber;
        if (codes.Contains(describer.DuplicateEmail(newUser.Email).Code)
            || codes.Contains(describer.DuplicateUserName(newUser.Email).Code))
        {
            return CreateUserResult.Failed(CreateUserFailure.DuplicateEmail);
        }

        return CreateUserResult.Failed(
            codes.Any(code => code.StartsWith("Password", StringComparison.Ordinal))
                ? CreateUserFailure.InvalidPassword
                : CreateUserFailure.InvalidEmail);
    }

    public async Task<Guid?> FindIdByCredentialsAsync(string email, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return null;
        }

        return await userManager.CheckPasswordAsync(user, password) ? user.Id : null;
    }

    public Task<MeResponse?> GetProfileAsync(Guid userId, CancellationToken cancellationToken) =>
        dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new MeResponse(u.Id, u.Email!, u.DisplayName, u.OnboardingCompletedAt))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<bool> CompleteOnboardingAsync(
        Guid userId,
        DateTimeOffset completedAt,
        CancellationToken cancellationToken)
    {
        var updated = await dbContext.Users
            .Where(u => u.Id == userId && u.OnboardingCompletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.OnboardingCompletedAt, completedAt), cancellationToken);

        return updated > 0 || await dbContext.Users.AnyAsync(u => u.Id == userId, cancellationToken);
    }

    private static bool IsUniqueViolation(DbUpdateException exception, string constraintName) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
        } postgresException
        && postgresException.ConstraintName == constraintName;
}
