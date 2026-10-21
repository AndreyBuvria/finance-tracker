using FluentValidation;

namespace FinanceTracker.Application.Auth;

/// <summary>Field limits and user-facing messages for sign-up and login (FEATURES.md F1).</summary>
public static class AuthRules
{
    /// <summary>Matches the Identity <c>AspNetUsers.DisplayName</c> column.</summary>
    public const int DisplayNameMaxLength = 100;

    /// <summary>Matches the Identity <c>Email</c>/<c>UserName</c> columns.</summary>
    public const int EmailMaxLength = 256;

    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128;

    public const string DisplayNameRequired = "Enter your name.";
    public const string DisplayNameTooLong = "Name can be at most 100 characters.";
    public const string EmailRequired = "Enter your email.";
    public const string EmailInvalid = "Enter a valid email address.";
    public const string EmailTooLong = "Email can be at most 256 characters.";
    public const string PasswordRequired = "Enter your password.";
    public const string PasswordTooShort = "Password must be at least 8 characters.";
    public const string PasswordTooLong = "Password can be at most 128 characters.";
    public const string PasswordNeedsLetterAndNumber = "Password must include at least one letter and one number.";
    public const string RefreshTokenRequired = "Refresh token is required.";

    public static bool HasLetterAndNumber(string password) =>
        password.Any(char.IsLetter) && password.Any(char.IsAsciiDigit);
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(r => r.DisplayName)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(AuthRules.DisplayNameRequired)
            .Must(name => name.Trim().Length <= AuthRules.DisplayNameMaxLength)
            .WithMessage(AuthRules.DisplayNameTooLong);

        RuleFor(r => r.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(AuthRules.EmailRequired)
            .Must(email => email.Trim().Length <= AuthRules.EmailMaxLength).WithMessage(AuthRules.EmailTooLong)
            .Must(email => !email.Trim().Any(char.IsWhiteSpace)).WithMessage(AuthRules.EmailInvalid)
            .EmailAddress().WithMessage(AuthRules.EmailInvalid);

        RuleFor(r => r.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(AuthRules.PasswordRequired)
            .MinimumLength(AuthRules.PasswordMinLength).WithMessage(AuthRules.PasswordTooShort)
            .MaximumLength(AuthRules.PasswordMaxLength).WithMessage(AuthRules.PasswordTooLong)
            .Must(AuthRules.HasLetterAndNumber).WithMessage(AuthRules.PasswordNeedsLetterAndNumber);
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(r => r.Email).NotEmpty().WithMessage(AuthRules.EmailRequired);
        RuleFor(r => r.Password).NotEmpty().WithMessage(AuthRules.PasswordRequired);
    }
}

public sealed class LogoutRequestValidator : AbstractValidator<LogoutRequest>
{
    public LogoutRequestValidator()
    {
        RuleFor(r => r.RefreshToken).NotEmpty().WithMessage(AuthRules.RefreshTokenRequired);
    }
}
