using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace FinanceTracker.Application.Auth;

/// <summary>Creates raw refresh tokens and the SHA-256 hashes stored in place of them.</summary>
public static class RefreshTokenCodec
{
    private const int _tokenBytes = 32;

    /// <summary>A new random URL-safe token (256 bits). Never store or log the raw value.</summary>
    public static string Generate() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(_tokenBytes));

    /// <summary>Lowercase hex SHA-256 of the raw token.</summary>
    public static string Hash(string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
