import { Routes } from '@angular/router';
import { TransactionsPage } from './transactions-page';

export const TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@transactions.route.title:Transactions · Finance Tracker`,
    component: TransactionsPage,
  },
];
