namespace FinanceTracker.Application.Auth;

public sealed record RegisterRequest(string DisplayName, string Email, string Password);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

/// <summary>Tokens returned by register, login and refresh.</summary>
/// <param name="AccessToken">Signed JWT for the <c>Authorization: Bearer</c> header.</param>
/// <param name="ExpiresIn">Access token lifetime in seconds.</param>
/// <param name="RefreshToken">Opaque single-use refresh token; rotated on every refresh.</param>
public sealed record AuthTokens(string AccessToken, int ExpiresIn, string RefreshToken);
