import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authInterceptor } from '@common/auth/auth.interceptor';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { routes } from './app.routes';

describe('App routes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideFakeClock('2026-10-21T10:00:00'),
        // As in app.config.ts (date adapter for the Transactions date range).
        provideAppLocale(),
      ],
    });
  });

  const url = () => TestBed.inject(Router).url;
  const root = (harness: RouterTestingHarness) => harness.fixture.nativeElement as HTMLElement;

  describe('logged out', () => {
    it('sends the root URL to login, returning to the dashboard afterwards', async () => {
      await RouterTestingHarness.create('/');
      expect(url()).toBe('/auth/login?returnUrl=%2Fdashboard');
    });

    it('sends authenticated pages to login with a returnUrl', async () => {
      await RouterTestingHarness.create('/transactions');
      expect(url()).toBe('/auth/login?returnUrl=%2Ftransactions');
    });

    it('renders auth pages without the app layout', async () => {
      const harness = await RouterTestingHarness.create('/auth');
      expect(url()).toBe('/auth/login');
      expect(root(harness).querySelector('app-layout')).toBeNull();
      expect(root(harness).querySelectorAll('main')).toHaveLength(1);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Log in');
    });

    it('lazy-loads the register page', async () => {
      const harness = await RouterTestingHarness.create('/auth/register');
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
        'Create an account',
      );
    });
  });

  describe('logged in', () => {
    const USER = { id: '1', email: 'k@e.com', displayName: 'Kasia' };
    let http: HttpTestingController;

    beforeEach(() => {
      localStorage.setItem('ft.refreshToken', 'refresh-1');
      http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.match(() => true));

    /**
     * Navigates to `path` as a user who has (or hasn't) finished onboarding: answers the silent
     * refresh and `GET /me` the guards wait for.
     */
    async function open(path: string, onboarded = true): Promise<RouterTestingHarness> {
      const harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl(path);
      const refresh = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      refresh.flush({ accessToken: 'access-1', expiresIn: 900, refreshToken: 'refresh-2' });
      const me = await vi.waitFor(() => http.expectOne('/api/me'));
      me.flush({ ...USER, onboardingCompletedAt: onboarded ? '2026-10-20T08:00:00Z' : null });
      await navigation;
      // Not `whenStable()`: the opened page's own requests stay pending.
      harness.detectChanges();
      return harness;
    }

    it('redirects the root URL and unknown URLs to the dashboard', async () => {
      await open('/');
      expect(url()).toBe('/dashboard');
      await TestBed.inject(Router).navigateByUrl('/does-not-exist');
      expect(url()).toBe('/dashboard');
    });

    it('redirects auth pages to the dashboard', async () => {
      await open('/auth/login');
      expect(url()).toBe('/dashboard');
    });

    it('renders authenticated pages inside the app layout', async () => {
      const harness = await open('/dashboard');
      expect(root(harness).querySelector('app-layout main h1')?.textContent).toBe('Dashboard');
      expect(root(harness).querySelectorAll('main')).toHaveLength(1);
    });

    it.each([
      ['/transactions', 'Transactions'],
      ['/accounts', 'Accounts'],
      ['/settings', 'Settings'],
    ])('lazy-loads %s', async (path, heading) => {
      const harness = await open(path);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(heading);
    });

    it('sends a user who has not finished onboarding to onboarding, outside the app layout', async () => {
      const harness = await open('/transactions', false);
      expect(url()).toBe('/onboarding');
      expect(root(harness).querySelector('app-layout')).toBeNull();
      expect(root(harness).querySelectorAll('main')).toHaveLength(1);
      expect(root(harness).querySelector('h1')?.textContent?.trim()).toBe(
        'Where do you keep your money?',
      );
    });

    it('keeps an onboarded user out of onboarding', async () => {
      await open('/onboarding');
      expect(url()).toBe('/dashboard');
    });
  });
});
