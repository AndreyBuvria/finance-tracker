import { Routes } from '@angular/router';
import { AuthPage } from './auth-page';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@auth.route.title:Log in · Finance Tracker`,
    component: AuthPage,
  },
];
