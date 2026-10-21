import { Routes } from '@angular/router';
import { DashboardPage } from './dashboard-page';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@dashboard.route.title:Dashboard · Finance Tracker`,
    component: DashboardPage,
  },
];
