import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import { ClockService } from '../time/clock.service';
import { authEndpointContext } from './auth.context';
import { AuthTokens, LoginRequest, Me, RegisterRequest } from './auth.model';
import { SessionLockService } from './session-lock.service';
import { TokenStorageService } from './token-storage.service';
import { UserStorageService } from './user-storage.service';

/**
 * Bound on the refresh and logout requests, which run while holding the cross-tab session lock: a
 * stalled request must not keep other tabs waiting. A timed-out refresh keeps the session.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/** Thrown by `refresh()` when there is no refresh token to use. */
export class NoSessionError extends Error {
  constructor() {
    super('No session to refresh.');
    this.name = 'NoSessionError';
  }
}

/**
 * True when the server rejected the session (refresh token invalid, expired or revoked) or there
 * is no session. Network errors and 5xx are not: the session is kept and the request just fails.
 */
export function isSessionRejected(error: unknown): boolean {
  return (
    error instanceof NoSessionError ||
    (error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status))
  );
}

/**
 * Session API (PLAN.md §7 Auth, Me). Tokens are kept by `TokenStorageService`. The signed-in user
 * (`GET /me`) is loaded once per session and cached, so the route guards and the layout share it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly tokens = inject(TokenStorageService);
  private readonly sessionLock = inject(SessionLockService);
  private readonly userStorage = inject(UserStorageService);
  private readonly clock = inject(ClockService);

  private refreshInFlight: Observable<string> | null = null;
  /** The signed-in user, once loaded in this session. */
  private cachedMe: Me | null = null;
  private meInFlight: Observable<Me> | null = null;
  /** Bumped whenever a session starts or ends, so a late `/me` answer can't fill the new session. */
  private session = 0;

  /** True while there is a stored session (a refresh token). Used by the route guards. */
  isAuthenticated(): boolean {
    return this.tokens.getRefreshToken() !== null;
  }

  register(request: RegisterRequest): Observable<void> {
    return this.startSession(`${this.api}/auth/register`, request);
  }

  login(request: LoginRequest): Observable<void> {
    return this.startSession(`${this.api}/auth/login`, request);
  }

  /**
   * Gets a new access token with the refresh token.
   * - In this tab, concurrent callers share one request.
   * - Across tabs, refreshes run one at a time (`SessionLockService`); the refresh token is read
   *   only once the lock is held, so a tab that waited uses the token another tab just stored
   *   instead of the one that tab already rotated.
   * If the server rejects the refresh token, the session is cleared.
   */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.sessionLock
      .run(() =>
        defer(() => {
          const refreshToken = this.tokens.getRefreshToken();
          if (!refreshToken) {
            return throwError(() => new NoSessionError());
          }
          return this.http.post<AuthTokens>(
            `${this.api}/auth/refresh`,
            { refreshToken },
            { context: authEndpointContext() },
          );
        }).pipe(
          timeout(AUTH_REQUEST_TIMEOUT_MS),
          // Store (or clear) before the lock is released, so the next tab sees the result.
          tap((tokens) => this.tokens.save(tokens)),
          catchError((error: unknown) => {
            if (isSessionRejected(error)) {
              this.endLocalSession();
            }
            return throwError(() => error);
          }),
        ),
      )
      .pipe(
        map((tokens) => tokens.accessToken),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  /**
   * Revokes the refresh token on the server (best effort) and always ends the local session.
   * Emits once the local session is cleared.
   */
  logout(): Observable<void> {
    const accessToken$ = defer(() => {
      const token = this.tokens.getAccessToken();
      return token ? of(token) : this.refresh();
    });
    return accessToken$.pipe(
      // Taken after `refresh()` (the lock is not reentrant), so the token sent is the newest one.
      switchMap((accessToken) =>
        this.sessionLock.run(() =>
          defer(() =>
            this.http.post<void>(
              `${this.api}/auth/logout`,
              { refreshToken: this.tokens.getRefreshToken() },
              {
                context: authEndpointContext(),
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            ),
          ).pipe(
            timeout(AUTH_REQUEST_TIMEOUT_MS),
            catchError(() => of(undefined)),
            map(() => this.tokens.clear()),
          ),
        ),
      ),
      catchError(() => of(undefined)),
      map(() => this.endLocalSession()),
      finalize(() => this.endLocalSession()),
    );
  }

  /**
   * The signed-in user. Loaded once per session and then served from the cache; concurrent callers
   * share one request, and a failed request is not cached (the next call tries again).
   */
  me(): Observable<Me> {
    if (this.cachedMe) {
      return of(this.cachedMe);
    }
    if (this.meInFlight) {
      return this.meInFlight;
    }
    const session = this.session;
    const request: Observable<Me> = this.http.get<Me>(`${this.api}/me`).pipe(
      tap((me) => {
        if (session === this.session) {
          this.cachedMe = me;
        }
      }),
      finalize(() => {
        if (this.meInFlight === request) {
          this.meInFlight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.meInFlight = request;
    return request;
  }

  /**
   * Finishes onboarding (`POST /me/onboarding/complete`, idempotent) and marks the cached user as
   * onboarded, so the guards let them into the app without asking the API again. Fails with a 409
   * "Add at least one account first." when the user has no active account.
   */
  completeOnboarding(): Observable<void> {
    return this.http.post<void>(`${this.api}/me/onboarding/complete`, null).pipe(
      tap(() => {
        if (this.cachedMe && !this.cachedMe.onboardingCompletedAt) {
          this.cachedMe = {
            ...this.cachedMe,
            onboardingCompletedAt: this.clock.now().toISOString(),
          };
        }
      }),
    );
  }

  /**
   * Forgets the tokens, the cached user and the user's session preferences (e.g. the last account
   * used). Device settings such as the shortcut choice stay.
   */
  private endLocalSession(): void {
    this.tokens.clear();
    this.userStorage.clearAll();
    this.forgetUser();
  }

  private forgetUser(): void {
    this.session++;
    this.cachedMe = null;
    this.meInFlight = null;
  }

  private startSession(url: string, body: RegisterRequest | LoginRequest): Observable<void> {
    return this.http.post<AuthTokens>(url, body, { context: authEndpointContext() }).pipe(
      map((tokens) => {
        this.forgetUser();
        this.tokens.save(tokens);
      }),
    );
  }
}
