import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('renders a main landmark with the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('main router-outlet')).toBeTruthy();
  });

  it('redirects the root URL to the dashboard', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Dashboard');
  });

  it.each([
    ['/auth', 'Log in'],
    ['/onboarding', 'Welcome'],
    ['/transactions', 'Transactions'],
    ['/accounts', 'Accounts'],
    ['/settings', 'Settings'],
  ])('lazy-loads %s', async (url, heading) => {
    const harness = await RouterTestingHarness.create(url);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
  });

  it('redirects unknown URLs to the dashboard', async () => {
    await RouterTestingHarness.create('/does-not-exist');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
