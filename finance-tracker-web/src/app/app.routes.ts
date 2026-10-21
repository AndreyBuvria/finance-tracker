import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@common/auth/auth.guard';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { routeSegment } from '@common/routing/app-routes.utils';

/**
 * Every page is lazy-loaded. Authenticated pages share the app layout and require a session;
 * auth pages redirect to the dashboard when already logged in.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routeSegment(AppRoutesEnum.Dashboard) },
  {
    path: routeSegment(AppRoutesEnum.Auth),
    canActivate: [guestGuard],
    loadChildren: () => import('@pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: routeSegment(AppRoutesEnum.Onboarding),
    canActivate: [authGuard],
    loadChildren: () =>
      import('@pages/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./authenticated-layout.component').then((m) => m.AuthenticatedLayoutComponent),
    children: [
      {
        path: routeSegment(AppRoutesEnum.Dashboard),
        loadChildren: () =>
          import('@pages/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: routeSegment(AppRoutesEnum.Transactions),
        loadChildren: () =>
          import('@pages/transactions/transactions.routes').then((m) => m.TRANSACTIONS_ROUTES),
      },
      {
        path: routeSegment(AppRoutesEnum.Accounts),
        loadChildren: () =>
          import('@pages/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES),
      },
      {
        path: routeSegment(AppRoutesEnum.Settings),
        loadChildren: () =>
          import('@pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: routeSegment(AppRoutesEnum.Dashboard) },
];
