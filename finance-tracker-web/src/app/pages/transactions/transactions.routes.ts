import { Routes } from '@angular/router';
import { provideLocalizedDatepickerIntl } from '@common/locale/localized-datepicker-intl.service';
import { TransactionsComponent } from './transactions.component';

export const TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@transactions.route.title:Transactions · Finance Tracker`,
    providers: [provideLocalizedDatepickerIntl()],
    component: TransactionsComponent,
  },
];
