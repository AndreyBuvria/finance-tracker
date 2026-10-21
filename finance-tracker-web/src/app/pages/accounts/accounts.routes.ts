import { Routes } from '@angular/router';
import { AccountsPage } from './accounts-page';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@accounts.route.title:Accounts · Finance Tracker`,
    component: AccountsPage,
  },
];
