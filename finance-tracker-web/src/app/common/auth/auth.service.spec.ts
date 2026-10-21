import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFakeClock } from '../time/testing/fake-clock.service';
import { AUTH_ENDPOINT } from './auth.context';
import { AuthTokens } from './auth.model';
import { AuthService, NoSessionError } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const TOKENS: AuthTokens = { accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' };
const ROTATED: AuthTokens = { accessToken: 'access-2', expiresIn: 900, refreshToken: 'refresh-2' };

describe('AuthService', () => {
  let auth: AuthService;
  let tokens: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeClock('2026-10-21T10:00:00'),
      ],
    });
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('logs in and stores the session', async () => {
    const done = firstValueFrom(auth.login({ email: 'kasia@example.com', password: 'secret123' }));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'kasia@example.com', password: 'secret123' });
    expect(req.request.context.get(AUTH_ENDPOINT)).toBe(true);
    req.flush(TOKENS);
    await done;
    expect(auth.isAuthenticated()).toBe(true);
    expect(tokens.getAccessToken()).toBe('access-1');
  });

  it('registers and stores the session', async () => {
    const body = { displayName: 'Kasia', email: 'kasia@example.com', password: 'secret123' };
    const done = firstValueFrom(auth.register(body));
    const req = http.expectOne('/api/auth/register');
    expect(req.request.body).toEqual(body);
    req.flush(TOKENS, { status: 201, statusText: 'Created' });
    await done;
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('does not store anything when login fails', async () => {
    const done = firstValueFrom(auth.login({ email: 'a@b.c', password: 'x' }));
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.isAuthenticated()).toBe(false);
  });

  describe('refresh', () => {
    beforeEach(() => tokens.save(TOKENS));

    it('shares one request between concurrent callers and rotates the tokens', async () => {
      const first = firstValueFrom(auth.refresh());
      const second = firstValueFrom(auth.refresh());
      const req = http.expectOne('/api/auth/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      req.flush(ROTATED);
      expect(await first).toBe('access-2');
      expect(await second).toBe('access-2');
      expect(tokens.getRefreshToken()).toBe('refresh-2');
    });

    it('starts a new request once the previous one has finished', async () => {
      const first = firstValueFrom(auth.refresh());
      http.expectOne('/api/auth/refresh').flush(ROTATED);
      await first;
      const second = firstValueFrom(auth.refresh());
      const req = http.expectOne('/api/auth/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'refresh-2' });
      req.flush(TOKENS);
      await second;
    });

    it('clears the session when the refresh token is rejected', async () => {
      const result = firstValueFrom(auth.refresh());
      http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(auth.isAuthenticated()).toBe(false);
      expect(tokens.getAccessToken()).toBeNull();
    });
  });

  it('keeps the session when the refresh fails for network reasons', async () => {
    tokens.save(TOKENS);
    const result = firstValueFrom(auth.refresh());
    http.expectOne('/api/auth/refresh').flush(null, { status: 502, statusText: 'Bad Gateway' });
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('fails refresh without a session', async () => {
    await expect(firstValueFrom(auth.refresh())).rejects.toBeInstanceOf(NoSessionError);
  });

  describe('logout', () => {
    it('revokes the refresh token with the bearer token and clears the session', async () => {
      tokens.save(TOKENS);
      const done = firstValueFrom(auth.logout());
      const req = http.expectOne('/api/auth/logout');
      expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
      expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('refreshes first when the access token is gone (after a reload)', async () => {
      localStorage.setItem('ft.refreshToken', 'refresh-1');
      const done = firstValueFrom(auth.logout());
      http.expectOne('/api/auth/refresh').flush(ROTATED);
      const req = http.expectOne('/api/auth/logout');
      expect(req.request.body).toEqual({ refreshToken: 'refresh-2' });
      expect(req.request.headers.get('Authorization')).toBe('Bearer access-2');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('ends the local session even when the server call fails', async () => {
      tokens.save(TOKENS);
      const done = firstValueFrom(auth.logout());
      http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Error' });
      await done;
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  it('loads the current user', async () => {
    const me = firstValueFrom(auth.me());
    const user = { id: '1', email: 'k@e.com', displayName: 'Kasia', onboardingCompletedAt: null };
    http.expectOne('/api/me').flush(user);
    expect(await me).toEqual(user);
  });
});
