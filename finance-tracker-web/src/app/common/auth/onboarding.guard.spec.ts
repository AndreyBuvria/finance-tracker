import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { Me } from './auth.model';
import { AuthService } from './auth.service';
import { onboardingCompletedGuard, onboardingPendingGuard } from './onboarding.guard';

@Component({ template: '<h1>page</h1>' })
class Page {}

const USER: Me = { id: '1', email: 'k@e.com', displayName: 'Kasia', onboardingCompletedAt: null };
const ONBOARDED: Me = { ...USER, onboardingCompletedAt: '2026-10-20T08:00:00Z' };

describe('onboarding guards', () => {
  function setup(me: () => Observable<Me>, authenticated = true) {
    const auth = { isAuthenticated: () => authenticated, me: vi.fn(me) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'onboarding', canActivate: [onboardingPendingGuard], component: Page },
          { path: 'dashboard', canActivate: [onboardingCompletedGuard], component: Page },
          { path: 'transactions', canActivate: [onboardingCompletedGuard], component: Page },
        ]),
      ],
    });
    return auth;
  }

  const url = () => TestBed.inject(Router).url;

  describe('onboardingCompletedGuard', () => {
    it('sends a user who has not finished onboarding to onboarding', async () => {
      setup(() => of(USER));
      await RouterTestingHarness.create('/transactions');
      expect(url()).toBe('/onboarding');
    });

    it('lets an onboarded user through', async () => {
      setup(() => of(ONBOARDED));
      await RouterTestingHarness.create('/transactions');
      expect(url()).toBe('/transactions');
    });

    it('opens the page when the user cannot be loaded', async () => {
      setup(() => throwError(() => new Error('offline')));
      await RouterTestingHarness.create('/dashboard');
      expect(url()).toBe('/dashboard');
    });

    it('does not load the user without a session (authGuard decides)', async () => {
      const auth = setup(() => of(USER), false);
      await RouterTestingHarness.create('/dashboard');
      expect(auth.me).not.toHaveBeenCalled();
    });
  });

  describe('onboardingPendingGuard', () => {
    it('shows onboarding to a user who has not finished it', async () => {
      setup(() => of(USER));
      await RouterTestingHarness.create('/onboarding');
      expect(url()).toBe('/onboarding');
    });

    it('keeps an onboarded user out of onboarding', async () => {
      setup(() => of(ONBOARDED));
      await RouterTestingHarness.create('/onboarding');
      expect(url()).toBe('/dashboard');
    });

    it('opens onboarding when the user cannot be loaded', async () => {
      setup(() => throwError(() => new Error('offline')));
      await RouterTestingHarness.create('/onboarding');
      expect(url()).toBe('/onboarding');
    });
  });
});
