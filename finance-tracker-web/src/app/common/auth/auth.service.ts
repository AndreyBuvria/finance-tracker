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
} from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import { authEndpointContext } from './auth.context';
import { AuthTokens, LoginRequest, Me, RegisterRequest } from './auth.model';
import { TokenStorageService } from './token-storage.service';

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

/** Session API (PLAN.md §7 Auth, Me). Tokens are kept by `TokenStorageService`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly tokens = inject(TokenStorageService);

  private refreshInFlight: Observable<string> | null = null;

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
   * Gets a new access token with the refresh token. Concurrent callers share one request.
   * If the server rejects the refresh token, the session is cleared.
   */
  refresh(): Observable<string> {
    this.refreshInFlight ??= defer(() => {
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
      tap((tokens) => this.tokens.save(tokens)),
      map((tokens) => tokens.accessToken),
      catchError((error: unknown) => {
        if (isSessionRejected(error)) {
          this.tokens.clear();
        }
        return throwError(() => error);
      }),
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
      switchMap((accessToken) =>
        this.http.post<void>(
          `${this.api}/auth/logout`,
          { refreshToken: this.tokens.getRefreshToken() },
          {
            context: authEndpointContext(),
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
      catchError(() => of(undefined)),
      map(() => this.tokens.clear()),
      finalize(() => this.tokens.clear()),
    );
  }

  me(): Observable<Me> {
    return this.http.get<Me>(`${this.api}/me`);
  }

  private startSession(url: string, body: RegisterRequest | LoginRequest): Observable<void> {
    return this.http
      .post<AuthTokens>(url, body, { context: authEndpointContext() })
      .pipe(map((tokens) => this.tokens.save(tokens)));
  }
}
