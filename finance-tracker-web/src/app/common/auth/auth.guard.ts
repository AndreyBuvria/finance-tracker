import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRoutesEnum } from '../routing/app-routes.enum';
import { AuthService } from './auth.service';

/** Authenticated pages: without a session, go to the login page and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isAuthenticated() ||
  inject(Router).createUrlTree([AppRoutesEnum.Login], { queryParams: { returnUrl: state.url } });

/** Auth pages (login, register): already logged in → dashboard. */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree([AppRoutesEnum.Dashboard]);
