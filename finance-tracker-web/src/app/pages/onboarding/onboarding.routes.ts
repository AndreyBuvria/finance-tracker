import { Routes } from '@angular/router';
import { OnboardingPage } from './onboarding-page';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    title: $localize`:@@onboarding.route.title:Welcome · Finance Tracker`,
    component: OnboardingPage,
  },
];
