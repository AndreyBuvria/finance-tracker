import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideFakeClock } from '../time/testing/fake-clock.service';
import { authEndpointContext } from './auth.context';
import { authInterceptor } from './auth.interceptor';
import { AuthTokens } from './auth.model';
import { TokenStorageService } from './token-storage.service';

@Component({ template: '' })
class Blank {}

const TOKENS: AuthTokens = { accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' };
const ROTATED: AuthTokens = { accessToken: 'access-2', expiresIn: 900, refreshToken: 'refresh-2' };
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let tokens: TokenStorageService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Blank }]),
        provideFakeClock('2026-10-21T10:00:00'),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/transactions?month=2026-10');
  });

  afterEach(() => backend.verify());

  const authHeader = (url: string) => backend.expectOne(url).request.headers.get('Authorization');

  it('adds the bearer token to API requests', async () => {
    tokens.save(TOKENS);
    const result = firstValueFrom(http.get('/api/accounts'));
    const req = backend.expectOne('/api/accounts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush([]);
    expect(await result).toEqual([]);
  });

  it('leaves non-API requests alone', () => {
    tokens.save(TOKENS);
    http.get('https://bucket.s3.amazonaws.com/upload').subscribe();
    http.get('/apiary').subscribe();
    expect(authHeader('https://bucket.s3.amazonaws.com/upload')).toBeNull();
    expect(authHeader('/apiary')).toBeNull();
  });

  it('leaves the auth endpoints alone (no header, no refresh on 401)', async () => {
    tokens.save(TOKENS);
    const navigate = vi.spyOn(router, 'navigate');
    const result = firstValueFrom(
      http.post('/api/auth/login', {}, { context: authEndpointContext() }),
    );
    const req = backend.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, UNAUTHORIZED);
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    backend.expectNone('/api/auth/refresh');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('refreshes before sending when only the refresh token is left (after a reload)', async () => {
    localStorage.setItem('ft.refreshToken', 'refresh-1');
    const result = firstValueFrom(http.get('/api/me'));
    backend.expectOne('/api/auth/refresh').flush(ROTATED);
    const req = backend.expectOne('/api/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-2');
    req.flush({ displayName: 'Kasia' });
    expect(await result).toEqual({ displayName: 'Kasia' });
  });

  it('refreshes once for concurrent 401s and retries every request with the new token', async () => {
    tokens.save(TOKENS);
    const a = firstValueFrom(http.get('/api/accounts'));
    const b = firstValueFrom(http.get('/api/categories'));
    const c = firstValueFrom(http.get('/api/me'));
    for (const url of ['/api/accounts', '/api/categories', '/api/me']) {
      backend.expectOne(url).flush(null, UNAUTHORIZED);
    }

    const refresh = backend.match('/api/auth/refresh');
    expect(refresh).toHaveLength(1);
    expect(refresh[0].request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh[0].flush(ROTATED);

    for (const url of ['/api/accounts', '/api/categories', '/api/me']) {
      const retry = backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
      retry.flush(url);
    }
    expect(await Promise.all([a, b, c])).toEqual(['/api/accounts', '/api/categories', '/api/me']);
  });

  it('retries with the already refreshed token when a stale request fails later', async () => {
    tokens.save(TOKENS);
    const stale = firstValueFrom(http.get('/api/accounts'));
    const staleReq = backend.expectOne('/api/accounts');
    tokens.save(ROTATED); // another request refreshed meanwhile
    staleReq.flush(null, UNAUTHORIZED);

    backend.expectNone('/api/auth/refresh');
    const retry = backend.expectOne('/api/accounts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush('ok');
    expect(await stale).toBe('ok');
  });

  it('redirects to login with the current page as returnUrl when the refresh fails', async () => {
    tokens.save(TOKENS);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const result = firstValueFrom(http.get('/api/accounts'));
    backend.expectOne('/api/accounts').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(null, UNAUTHORIZED);

    await expect(result).rejects.toMatchObject({ status: 401, url: '/api/accounts' });
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/transactions?month=2026-10' },
    });
    expect(tokens.getRefreshToken()).toBeNull();
  });

  it('keeps the session and does not redirect when the refresh fails for network reasons', async () => {
    tokens.save(TOKENS);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const result = firstValueFrom(http.get('/api/accounts'));
    backend.expectOne('/api/accounts').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(null, { status: 503, statusText: 'Unavailable' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(navigate).not.toHaveBeenCalled();
    expect(tokens.getRefreshToken()).toBe('refresh-1');
  });

  it('redirects to login without a session at all', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const result = firstValueFrom(http.get('/api/accounts'));
    const req = backend.expectOne('/api/accounts');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, UNAUTHORIZED);
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the retried request is rejected again', async () => {
    tokens.save(TOKENS);
    const result = firstValueFrom(http.get('/api/accounts'));
    backend.expectOne('/api/accounts').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(ROTATED);
    backend.expectOne('/api/accounts').flush(null, UNAUTHORIZED);
    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone('/api/auth/refresh');
  });

  it('passes other errors through without refreshing', async () => {
    tokens.save(TOKENS);
    const result = firstValueFrom(http.get('/api/accounts'));
    backend.expectOne('/api/accounts').flush(null, { status: 500, statusText: 'Server Error' });
    await expect(result).rejects.toMatchObject({ status: 500 });
    backend.expectNone('/api/auth/refresh');
  });
});
