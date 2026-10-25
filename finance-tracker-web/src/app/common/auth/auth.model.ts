/*
 * Request/response shapes for PLAN.md §7 "Auth contract (agreed)" as needed by FEATURES.md F1.
 * Routes (under /api): POST /auth/register, POST /auth/login, POST /auth/refresh,
 * POST /auth/logout (JWT required), GET /me.
 *
 * Statuses:
 * - register: 201 + AuthTokens; 409 ProblemDetails for a duplicate email; 400 validation ProblemDetails
 * - login:    200 + AuthTokens; 401 ProblemDetails for wrong email or password (never says which)
 * - refresh:  200 + AuthTokens (refresh token rotated); 401 when invalid, expired or revoked;
 *             a token rotated within the last ~10 s still returns a fresh pair (grace window)
 * - logout:   204 (revokes the caller's own refresh token; no-op for unknown/revoked tokens)
 * - me:       200 + Me; 401 if the user no longer exists
 * Errors are RFC 7807 ProblemDetails; validation errors carry `errors` keyed by camelCase field name.
 */

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of POST /auth/refresh and POST /auth/logout. */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Response of register, login and refresh. */
export interface AuthTokens {
  /** Short-lived JWT (15 min), sent as `Authorization: Bearer …`. */
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  /** Long-lived (14 days), opaque, rotated on every refresh. */
  refreshToken: string;
}

/** Response of GET /me. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  /** ISO 8601 timestamp; null until onboarding is finished or skipped. */
  onboardingCompletedAt: string | null;
}
