/*
 * Proposed contract — pending backend alignment.
 *
 * Minimal request/response shapes for PLAN.md §7 "Auth" and "Me" as needed by FEATURES.md F1.
 * Routes (under /api): POST /auth/register, POST /auth/login, POST /auth/refresh,
 * POST /auth/logout (JWT required), GET /me.
 *
 * Expected statuses:
 * - register: 201 + AuthTokens; 409 ProblemDetails for a duplicate email; 400 validation ProblemDetails
 * - login:    200 + AuthTokens; 401 ProblemDetails for wrong email or password (never says which)
 * - refresh:  200 + AuthTokens (refresh token rotated); 401 when invalid, expired or revoked
 * - logout:   204 (revokes the given refresh token)
 * - me:       200 + Me
 * Errors are RFC 7807 ProblemDetails; validation errors carry `errors` keyed by field name.
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

/** RFC 7807 error body. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Validation errors keyed by field name, e.g. `{ "Email": ["…"] }`. */
  errors?: Record<string, string[]>;
}
