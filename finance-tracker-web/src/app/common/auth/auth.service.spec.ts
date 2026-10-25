import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { provideFakeClock } from '../time/testing/fake-clock.service';
import { AUTH_ENDPOINT } from './auth.context';
import { AuthTokens } from './auth.model';
import { AUTH_REQUEST_TIMEOUT_MS, AuthService, NoSessionError } from './auth.service';
import { FakeLockManager, installLockManager } from './testing/fake-lock-manager';
import { TokenStorageService } from './token-storage.service';

const TOKENS: AuthTokens = { accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-1' };
const ROTATED: AuthTokens = { accessToken: 'access-2', expiresIn: 900, refreshToken: 'refresh-2' };
const ROTATED_AGAIN: AuthTokens = {
  accessToken: 'access-3',
  expiresIn: 900,
  refreshToken: 'refresh-3',
};

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

    it("ends the local session like logout, forgetting the user's session preferences", async () => {
      localStorage.setItem('ft.user.u1.lastAccountId', 'a1');
      localStorage.setItem('ft.userDevice.u1.shortcutsDisabled', 'true');
      localStorage.setItem('unrelated', 'kept');
      const result = firstValueFrom(auth.refresh());
      http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(localStorage.getItem('ft.user.u1.lastAccountId')).toBeNull();
      expect(localStorage.getItem('ft.userDevice.u1.shortcutsDisabled')).toBe('true');
      expect(localStorage.getItem('unrelated')).toBe('kept');
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

    it("forgets the user's session preferences but keeps their device settings", async () => {
      localStorage.setItem('ft.user.u1.lastAccountId', 'a1');
      localStorage.setItem('ft.userDevice.u1.shortcutsDisabled', 'true');
      tokens.save(TOKENS);
      const done = firstValueFrom(auth.logout());
      http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(localStorage.getItem('ft.user.u1.lastAccountId')).toBeNull();
      expect(localStorage.getItem('ft.userDevice.u1.shortcutsDisabled')).toBe('true');
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

  describe('across tabs (Web Locks)', () => {
    let uninstall: () => void;
    /**
     * A second tab: its own AuthService and TokenStorageService (own in-memory access token) on the
     * same localStorage, HTTP backend and lock manager.
     */
    let otherTab: AuthService;

    beforeEach(() => {
      uninstall = installLockManager(new FakeLockManager());
      otherTab = Injector.create({
        providers: [AuthService, TokenStorageService],
        parent: TestBed.inject(Injector),
      }).get(AuthService);
      localStorage.setItem('ft.refreshToken', 'refresh-1');
    });

    afterEach(() => uninstall());

    it('refreshes one tab at a time, each with the newest stored refresh token', async () => {
      const first = firstValueFrom(auth.refresh());
      const second = firstValueFrom(otherTab.refresh());

      const firstReq = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      expect(firstReq.request.body).toEqual({ refreshToken: 'refresh-1' });
      http.expectNone('/api/auth/refresh');
      firstReq.flush(ROTATED);
      expect(await first).toBe('access-2');

      const secondReq = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      expect(secondReq.request.body).toEqual({ refreshToken: 'refresh-2' });
      secondReq.flush(ROTATED_AGAIN);
      expect(await second).toBe('access-3');
      expect(tokens.getRefreshToken()).toBe('refresh-3');
    });

    it('does not reuse a token after another tab lost the session', async () => {
      const first = firstValueFrom(auth.refresh());
      const second = firstValueFrom(otherTab.refresh());
      const req = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      req.flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(first).rejects.toBeInstanceOf(HttpErrorResponse);
      await expect(second).rejects.toBeInstanceOf(NoSessionError);
      http.expectNone('/api/auth/refresh');
    });

    describe('with a stalled request', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('gives up a refresh after the timeout, keeps the session and frees the lock', async () => {
        const first = firstValueFrom(auth.refresh());
        const firstFailed = expect(first).rejects.toBeInstanceOf(TimeoutError);
        const second = firstValueFrom(otherTab.refresh());
        await vi.advanceTimersByTimeAsync(0);
        const stalled = http.expectOne('/api/auth/refresh');
        await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
        await firstFailed;
        expect(stalled.cancelled).toBe(true);
        expect(auth.isAuthenticated()).toBe(true);

        await vi.advanceTimersByTimeAsync(0);
        const req = http.expectOne('/api/auth/refresh');
        expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
        req.flush(ROTATED);
        expect(await second).toBe('access-2');
      });

      it('ends the local session when logout times out', async () => {
        tokens.save(TOKENS);
        const done = firstValueFrom(auth.logout());
        await vi.advanceTimersByTimeAsync(0);
        const stalled = http.expectOne('/api/auth/logout');
        await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
        await done;
        expect(stalled.cancelled).toBe(true);
        expect(auth.isAuthenticated()).toBe(false);
      });
    });

    it('logs out with the token another tab is just rotating', async () => {
      tokens.save(TOKENS);
      const refreshing = firstValueFrom(otherTab.refresh());
      const done = firstValueFrom(auth.logout());
      const refreshReq = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      http.expectNone('/api/auth/logout');
      refreshReq.flush(ROTATED);
      await refreshing;

      const logoutReq = await vi.waitFor(() => http.expectOne('/api/auth/logout'));
      expect(logoutReq.request.body).toEqual({ refreshToken: 'refresh-2' });
      logoutReq.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('current user', () => {
    const user = { id: '1', email: 'k@e.com', displayName: 'Kasia', onboardingCompletedAt: null };

    it('loads the current user once and serves it from the cache afterwards', async () => {
      const first = firstValueFrom(auth.me());
      const concurrent = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(user);
      expect(await first).toEqual(user);
      expect(await concurrent).toEqual(user);
      expect(await firstValueFrom(auth.me())).toEqual(user);
      http.expectNone('/api/me');
    });

    it('does not cache a failed request', async () => {
      const failed = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(null, { status: 500, statusText: 'Server Error' });
      await expect(failed).rejects.toBeInstanceOf(HttpErrorResponse);
      const retry = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(user);
      expect(await retry).toEqual(user);
    });

    it('loads the user again after logout and a new login', async () => {
      tokens.save(TOKENS);
      const me = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(user);
      await me;
      const loggedOut = firstValueFrom(auth.logout());
      http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
      await loggedOut;

      const loggedIn = firstValueFrom(auth.login({ email: 'a@b.c', password: 'secret123' }));
      http.expectOne('/api/auth/login').flush(TOKENS);
      await loggedIn;
      const next = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush({ ...user, id: '2' });
      expect((await next).id).toBe('2');
    });

    it('ignores a /me answer that arrives after the session ended', async () => {
      tokens.save(TOKENS);
      const late = firstValueFrom(auth.me());
      const req = http.expectOne('/api/me');
      const loggedIn = firstValueFrom(auth.login({ email: 'a@b.c', password: 'secret123' }));
      http.expectOne('/api/auth/login').flush(ROTATED);
      await loggedIn;
      req.flush(user);
      await late;
      const fresh = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush({ ...user, id: '2' });
      expect((await fresh).id).toBe('2');
    });

    it('completes onboarding and marks the cached user as onboarded', async () => {
      const me = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(user);
      await me;
      const done = firstValueFrom(auth.completeOnboarding(), { defaultValue: undefined });
      const req = http.expectOne('/api/me/onboarding/complete');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      const completedAt = (await firstValueFrom(auth.me())).onboardingCompletedAt;
      expect(completedAt).toBe(new Date('2026-10-21T10:00:00').toISOString());
    });

    it('keeps the cached user unchanged when completing fails', async () => {
      const me = firstValueFrom(auth.me());
      http.expectOne('/api/me').flush(user);
      await me;
      const done = firstValueFrom(auth.completeOnboarding());
      http
        .expectOne('/api/me/onboarding/complete')
        .flush(
          { detail: 'Add at least one account first.' },
          { status: 409, statusText: 'Conflict' },
        );
      await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
      expect((await firstValueFrom(auth.me())).onboardingCompletedAt).toBeNull();
    });
  });
});
