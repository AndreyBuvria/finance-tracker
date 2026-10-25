using Microsoft.Extensions.Options;

namespace FinanceTracker.Api.Authentication;

/// <summary>
/// Validates <see cref="JwtOptions"/> at startup. Besides the basic shape, it refuses the public
/// local-development signing key outside Development and Testing, so a deployment that forgot to set
/// <c>Jwt__SigningKey</c> cannot start with a key anyone could use to forge access tokens.
/// </summary>
internal sealed class JwtOptionsValidator(IHostEnvironment environment) : IValidateOptions<JwtOptions>
{
    private const string _testingEnvironment = "Testing";

    public ValidateOptionsResult Validate(string? name, JwtOptions options)
    {
        if (!options.IsValid)
        {
            return ValidateOptionsResult.Fail(
                $"'{JwtOptions.SectionName}' settings are invalid. Issuer and Audience are required, " +
                $"SigningKey must be at least {JwtOptions.MinSigningKeyBytes} bytes (set it with user-secrets " +
                "or the Jwt__SigningKey environment variable), RefreshTokenLifetime must be longer than " +
                "AccessTokenLifetime, and RefreshTokenReuseGraceWindow must be between zero and AccessTokenLifetime.");
        }

        var isLocalEnvironment = environment.IsDevelopment() || environment.IsEnvironment(_testingEnvironment);
        if (!isLocalEnvironment
            && string.Equals(options.SigningKey, JwtOptions.LocalDevelopmentSigningKey, StringComparison.Ordinal))
        {
            return ValidateOptionsResult.Fail(
                $"'{JwtOptions.SectionName}:SigningKey' is the public local-development key from docker-compose.yml, " +
                $"which is not allowed in the '{environment.EnvironmentName}' environment. Set a unique secret of at " +
                $"least {JwtOptions.MinSigningKeyBytes} bytes through Jwt__SigningKey (Secrets Manager / Parameter " +
                "Store when deployed, or JWT_SIGNING_KEY for docker compose).");
        }

        return ValidateOptionsResult.Success;
    }
}
