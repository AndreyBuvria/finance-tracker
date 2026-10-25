import { DOCUMENT, inject, Injectable } from '@angular/core';
import { ClockService } from '../time/clock.service';
import { AuthTokens } from './auth.model';
import { jwtSubject } from './jwt.utils';

const REFRESH_TOKEN_KEY = 'ft.refreshToken';
/** Treat the access token as expired a bit early so it never expires in flight. */
const EXPIRY_SKEW_MS = 30_000;

/**
 * Keeps the session tokens.
 * - Access token: in memory only (gone on reload; a silent refresh gets a new one).
 * - Refresh token: in localStorage so the user stays logged in on this device (FEATURES.md F1).
 *   It is rotated on every refresh; reuse of a rotated token after the API's ~10 s grace window
 *   revokes the whole chain, so tabs refresh one at a time (`SessionLockService`).
 *   If storage is blocked (e.g. a SecurityError in some private modes), it is kept in memory
 *   instead, so the session lasts until reload.
 * Tokens are never logged.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly clock = inject(ClockService);
  private readonly window = inject(DOCUMENT).defaultView;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  /** Used only while localStorage can't be read or written. */
  private fallbackRefreshToken: string | null = null;

  save(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.accessTokenExpiresAt = this.clock.now().getTime() + tokens.expiresIn * 1000;
    this.writeRefreshToken(tokens.refreshToken);
  }

  /** The access token, or null if there is none or it is (about to be) expired. */
  getAccessToken(): string | null {
    if (!this.accessToken) {
      return null;
    }
    return this.clock.now().getTime() < this.accessTokenExpiresAt - EXPIRY_SKEW_MS
      ? this.accessToken
      : null;
  }

  /** ID of the signed-in user (the access token's `sub`), or null without an access token. */
  getUserId(): string | null {
    return jwtSubject(this.accessToken);
  }

  getRefreshToken(): string | null {
    // The in-memory copy is only set by a failed write, so it is always the newest token.
    if (this.fallbackRefreshToken) {
      return this.fallbackRefreshToken;
    }
    try {
      // Read lazily: merely touching `window.localStorage` throws when storage is blocked.
      return this.window?.localStorage.getItem(REFRESH_TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.writeRefreshToken(null);
  }

  private writeRefreshToken(refreshToken: string | null): void {
    try {
      const storage = this.window?.localStorage;
      if (refreshToken) {
        storage?.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        storage?.removeItem(REFRESH_TOKEN_KEY);
      }
      this.fallbackRefreshToken = null;
    } catch {
      // Storage blocked (SecurityError) or full (QuotaExceededError): keep it in memory.
      this.fallbackRefreshToken = refreshToken;
      // Drop any older token a previous write left behind: it may already be rotated (revoked),
      // and sending it after a reload would make the backend revoke the whole chain.
      this.removeStoredRefreshToken();
    }
  }

  private removeStoredRefreshToken(): void {
    try {
      this.window?.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Storage is blocked entirely; nothing was stored there.
    }
  }
}
