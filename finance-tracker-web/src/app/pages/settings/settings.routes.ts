import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@settings.route.title:Settings · Finance Tracker`,
    component: SettingsComponent,
  },
];
