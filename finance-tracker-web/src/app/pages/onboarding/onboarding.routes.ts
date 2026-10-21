import { Routes } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@onboarding.route.title:Welcome · Finance Tracker`,
    component: OnboardingComponent,
  },
];
