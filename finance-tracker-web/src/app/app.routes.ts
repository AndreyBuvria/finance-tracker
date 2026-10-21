import { Routes } from '@angular/router';

/** Every feature is lazy-loaded. Guards (auth, onboarding) come with the auth task. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./pages/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./pages/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'transactions',
    loadChildren: () =>
      import('./pages/transactions/transactions.routes').then((m) => m.TRANSACTIONS_ROUTES),
  },
  {
    path: 'accounts',
    loadChildren: () =>
      import('./pages/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES),
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
