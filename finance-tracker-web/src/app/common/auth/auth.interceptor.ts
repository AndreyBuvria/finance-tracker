import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, Observable, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import { AppRoutesEnum } from '../routing/app-routes.enum';
import { AUTH_ENDPOINT } from './auth.context';
import { AuthService, isSessionRejected } from './auth.service';
import { TokenStorageService } from './token-storage.service';

/**
 * For API requests (except the auth endpoints):
 * - adds `Authorization: Bearer <access token>`; refreshes first if the access token is missing
 *   or expired but a refresh token exists (e.g. after a reload);
 * - on 401, refreshes once and retries; concurrent requests share one refresh, and tabs refresh
 *   one at a time (see `AuthService.refresh`);
 * - if the server rejects the refresh, the session is gone: redirect to
 *   `/auth/login?returnUrl=<current page>`. Network errors/5xx during refresh keep the session
 *   (the user is never thrown out because the API is briefly unreachable).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(API_BASE_URL);
  if (!isApiRequest(request.url, apiBaseUrl) || request.context.get(AUTH_ENDPOINT)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const tokens = inject(TokenStorageService);
  const router = inject(Router);

  const send = (token: string | null) => next(withBearer(request, token));
  /** Fails the request with `error`; redirects to login if `refreshError` ended the session. */
  const refreshFailed = (
    refreshError: unknown,
    error: unknown = refreshError,
  ): Observable<never> => {
    if (isSessionRejected(refreshError)) {
      redirectToLogin(router);
    }
    return throwError(() => error);
  };

  const initialToken$ = defer(() => {
    const token = tokens.getAccessToken();
    if (token || !tokens.getRefreshToken()) {
      return of(token);
    }
    return auth.refresh().pipe(catchError((refreshError: unknown) => refreshFailed(refreshError)));
  });

  return initialToken$.pipe(
    switchMap((sentToken) =>
      send(sentToken).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          // Another request may already have refreshed while this one was in flight.
          const current = tokens.getAccessToken();
          const retryToken$ =
            current && current !== sentToken
              ? of(current)
              : auth
                  .refresh()
                  .pipe(catchError((refreshError: unknown) => refreshFailed(refreshError, error)));
          return retryToken$.pipe(switchMap((token) => send(token)));
        }),
      ),
    ),
  );
};

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url === apiBaseUrl || url.startsWith(`${apiBaseUrl}/`);
}

function withBearer<T>(request: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

function redirectToLogin(router: Router): void {
  const navigation = router.currentNavigation();
  const currentUrl = navigation
    ? router.serializeUrl(navigation.finalUrl ?? navigation.extractedUrl)
    : router.url;
  if (currentUrl.startsWith(AppRoutesEnum.Login)) {
    return;
  }
  void router.navigate([AppRoutesEnum.Login], { queryParams: { returnUrl: currentUrl } });
}
