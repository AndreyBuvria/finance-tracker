import { Routes } from '@angular/router';
import { AccountsComponent } from './accounts.component';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@accounts.route.title:Accounts · Finance Tracker`,
    component: AccountsComponent,
  },
];
