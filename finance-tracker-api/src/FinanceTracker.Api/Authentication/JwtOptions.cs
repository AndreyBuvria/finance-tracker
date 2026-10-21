using System.Text;

namespace FinanceTracker.Api.Authentication;

/// <summary>
/// JWT settings bound from the <c>Jwt</c> configuration section. <see cref="SigningKey"/> is a secret:
/// it comes from user-secrets or the <c>Jwt__SigningKey</c> environment variable locally and from
/// Secrets Manager / Parameter Store when deployed; it is never committed.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>HS256 needs a key of at least 256 bits.</summary>
    public const int MinSigningKeyBytes = 32;

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SigningKey { get; set; } = string.Empty;

    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);

    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(14);

    public byte[] SigningKeyBytes => Encoding.UTF8.GetBytes(SigningKey);

    public bool IsValid =>
        !string.IsNullOrWhiteSpace(Issuer)
        && !string.IsNullOrWhiteSpace(Audience)
        && SigningKeyBytes.Length >= MinSigningKeyBytes
        && AccessTokenLifetime > TimeSpan.Zero
        && RefreshTokenLifetime > AccessTokenLifetime;
}
