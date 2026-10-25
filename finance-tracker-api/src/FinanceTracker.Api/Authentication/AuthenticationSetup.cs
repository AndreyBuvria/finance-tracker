using System.Security.Claims;
using FinanceTracker.Application.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FinanceTracker.Api.Authentication;

public static class AuthenticationSetup
{
    /// <summary>
    /// JWT bearer authentication. Every endpoint requires an authenticated user unless it opts out
    /// with <c>[AllowAnonymous]</c> (register, login, refresh, health).
    /// </summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services)
    {
        services.AddOptions<JwtOptions>()
            .BindConfiguration(JwtOptions.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<JwtOptions>, JwtOptionsValidator>();

        services.AddSingleton<IAuthTokenIssuer, JwtAuthTokenIssuer>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

        // Configured lazily so design-time tools (dotnet ef) can build the host without a signing key.
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>, TimeProvider>((bearer, jwtOptions, timeProvider) =>
            {
                var jwt = jwtOptions.Value;
                bearer.MapInboundClaims = false;
                bearer.TimeProvider = timeProvider;
                bearer.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(jwt.SigningKeyBytes),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = JwtRegisteredClaimNames.Sub,
                    // Lifetime is checked against the injected clock, not the system clock.
                    LifetimeValidator = (notBefore, expires, _, parameters) =>
                        IsWithinLifetime(notBefore, expires, parameters.ClockSkew, timeProvider),
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        return services;
    }

    private static bool IsWithinLifetime(
        DateTime? notBefore,
        DateTime? expires,
        TimeSpan clockSkew,
        TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        return expires is not null
            && expires.Value.ToUniversalTime() > now - clockSkew
            && (notBefore is null || notBefore.Value.ToUniversalTime() <= now + clockSkew);
    }

    /// <summary>The authenticated user's ID from the access token's <c>sub</c> claim.</summary>
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(subject, out var userId)
            ? userId
            : throw new InvalidOperationException("The authenticated principal has no valid user ID claim.");
    }
}
