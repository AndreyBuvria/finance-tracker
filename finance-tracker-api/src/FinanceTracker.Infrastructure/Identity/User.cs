using Microsoft.AspNetCore.Identity;

namespace FinanceTracker.Infrastructure.Identity;

/// <summary>
/// Identity-backed application user. Email and password hash come from <see cref="IdentityUser{TKey}"/>.
/// </summary>
public sealed class User : IdentityUser<Guid>
{
    public const int DisplayNameMaxLength = 100;
    public const int DefaultCurrencyLength = 3;
    public const string DefaultCurrencyCode = "PLN";

    public required string DisplayName { get; set; }

    public string DefaultCurrency { get; set; } = DefaultCurrencyCode;

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Set once the user finishes (or skips) onboarding so it never shows again.</summary>
    public DateTimeOffset? OnboardingCompletedAt { get; set; }
}
