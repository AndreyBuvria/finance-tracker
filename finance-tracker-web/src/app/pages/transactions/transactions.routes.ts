import { Routes } from '@angular/router';
import { TransactionsComponent } from './transactions.component';

export const TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@transactions.route.title:Transactions · Finance Tracker`,
    component: TransactionsComponent,
  },
];
