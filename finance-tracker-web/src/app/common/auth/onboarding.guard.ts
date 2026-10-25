import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AppRoutesEnum } from '../routing/app-routes.enum';
import { AuthService } from './auth.service';

/**
 * App pages: a user who hasn't finished onboarding (`onboardingCompletedAt` is null) goes to
 * onboarding first (FEATURES.md F1, first login only). Use after `authGuard`; without a session it
 * lets `authGuard` decide. If the user can't be loaded (e.g. offline), the page opens anyway.
 */
export const onboardingCompletedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return auth.me().pipe(
    map((me) => !!me.onboardingCompletedAt || router.createUrlTree([AppRoutesEnum.Onboarding])),
    catchError(() => of(true)),
  );
};

/**
 * The onboarding page: a user who already finished it goes to the dashboard, so it never shows
 * again. Use after `authGuard`. If the user can't be loaded, onboarding opens (finishing it again is
 * harmless: the API keeps the first completion time).
 */
export const onboardingPendingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return auth.me().pipe(
    map((me) => !me.onboardingCompletedAt || router.createUrlTree([AppRoutesEnum.Dashboard])),
    catchError(() => of(true)),
  );
};
