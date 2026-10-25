using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using FinanceTracker.Application.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FinanceTracker.Api.Authentication;

internal sealed class JwtAuthTokenIssuer(IOptions<JwtOptions> options) : IAuthTokenIssuer
{
    /// <summary>Domain-separation label: the derivation key is never the JWT signing key itself.</summary>
    private static readonly byte[] _refreshDerivationLabel =
        Encoding.UTF8.GetBytes("finance-tracker/refresh-token-rotation/v1");

    private readonly JsonWebTokenHandler _handler = new() { SetDefaultTimesOnTokenCreation = false };

    private byte[]? _refreshDerivationKey;

    public TimeSpan AccessTokenLifetime => options.Value.AccessTokenLifetime;

    public TimeSpan RefreshTokenLifetime => options.Value.RefreshTokenLifetime;

    public TimeSpan RefreshTokenReuseGraceWindow => options.Value.RefreshTokenReuseGraceWindow;

    public string IssueAccessToken(Guid userId, DateTimeOffset issuedAt)
    {
        var jwt = options.Value;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            IssuedAt = issuedAt.UtcDateTime,
            NotBefore = issuedAt.UtcDateTime,
            Expires = (issuedAt + jwt.AccessTokenLifetime).UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = userId.ToString(),
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString(),
            },
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(jwt.SigningKeyBytes),
                SecurityAlgorithms.HmacSha256),
        };

        return _handler.CreateToken(descriptor);
    }

    public string DeriveSuccessorRefreshToken(string refreshToken)
    {
        // Sub-key = HMAC(signing key, label); successor = HMAC(sub-key, presented token): 256 bits, same
        // format as a freshly generated token. Changing Jwt:SigningKey only affects grace-window replays.
        _refreshDerivationKey ??= HMACSHA256.HashData(options.Value.SigningKeyBytes, _refreshDerivationLabel);
        return Base64Url.EncodeToString(
            HMACSHA256.HashData(_refreshDerivationKey, Encoding.UTF8.GetBytes(refreshToken)));
    }
}
