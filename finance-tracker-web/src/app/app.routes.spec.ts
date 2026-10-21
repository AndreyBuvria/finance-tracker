import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authInterceptor } from '@common/auth/auth.interceptor';
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
    beforeEach(() => localStorage.setItem('ft.refreshToken', 'refresh-1'));
    afterEach(() => TestBed.inject(HttpTestingController).match(() => true));

    it('redirects the root URL and unknown URLs to the dashboard', async () => {
      await RouterTestingHarness.create('/');
      expect(url()).toBe('/dashboard');
      await TestBed.inject(Router).navigateByUrl('/does-not-exist');
      expect(url()).toBe('/dashboard');
    });

    it('redirects auth pages to the dashboard', async () => {
      await RouterTestingHarness.create('/auth/login');
      expect(url()).toBe('/dashboard');
    });

    it('renders authenticated pages inside the app layout', async () => {
      const harness = await RouterTestingHarness.create('/dashboard');
      expect(root(harness).querySelector('app-layout main h1')?.textContent).toBe('Dashboard');
      expect(root(harness).querySelectorAll('main')).toHaveLength(1);
    });

    it.each([
      ['/onboarding', 'Welcome'],
      ['/transactions', 'Transactions'],
      ['/accounts', 'Accounts'],
      ['/settings', 'Settings'],
    ])('lazy-loads %s', async (path, heading) => {
      const harness = await RouterTestingHarness.create(path);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
    });
  });
});
