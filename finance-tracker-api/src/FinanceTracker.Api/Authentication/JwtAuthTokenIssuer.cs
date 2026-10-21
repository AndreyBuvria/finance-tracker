using FinanceTracker.Application.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FinanceTracker.Api.Authentication;

internal sealed class JwtAuthTokenIssuer(IOptions<JwtOptions> options) : IAuthTokenIssuer
{
    private readonly JsonWebTokenHandler _handler = new() { SetDefaultTimesOnTokenCreation = false };

    public TimeSpan AccessTokenLifetime => options.Value.AccessTokenLifetime;

    public TimeSpan RefreshTokenLifetime => options.Value.RefreshTokenLifetime;

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
}
