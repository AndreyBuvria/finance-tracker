import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideFakeClock } from '../time/testing/fake-clock.service';
import { authGuard, guestGuard } from './auth.guard';

@Component({ template: '<h1>page</h1>' })
class Page {}

describe('auth guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideFakeClock('2026-10-21T10:00:00'),
        provideRouter([
          { path: 'auth/login', canActivate: [guestGuard], component: Page },
          { path: 'dashboard', canActivate: [authGuard], component: Page },
          { path: 'transactions', canActivate: [authGuard], component: Page },
        ]),
      ],
    });
  });

  const url = () => TestBed.inject(Router).url;

  describe('authGuard', () => {
    it('sends visitors without a session to login with a returnUrl', async () => {
      await RouterTestingHarness.create('/transactions?month=2026-10');
      expect(url()).toBe('/auth/login?returnUrl=%2Ftransactions%3Fmonth%3D2026-10');
    });

    it('lets logged-in users through', async () => {
      localStorage.setItem('ft.refreshToken', 'refresh-1');
      await RouterTestingHarness.create('/transactions');
      expect(url()).toBe('/transactions');
    });
  });

  describe('guestGuard', () => {
    it('shows the auth pages to visitors', async () => {
      await RouterTestingHarness.create('/auth/login');
      expect(url()).toBe('/auth/login');
    });

    it('sends logged-in users to the dashboard', async () => {
      localStorage.setItem('ft.refreshToken', 'refresh-1');
      await RouterTestingHarness.create('/auth/login');
      expect(url()).toBe('/dashboard');
    });
  });
});
