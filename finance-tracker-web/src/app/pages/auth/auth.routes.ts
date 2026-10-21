import { Routes } from '@angular/router';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { routeSegment } from '@common/routing/app-routes.utils';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: routeSegment(AppRoutesEnum.Login, AppRoutesEnum.Auth),
  },
  {
    path: routeSegment(AppRoutesEnum.Login, AppRoutesEnum.Auth),
    title: $localize`:@@auth.login.route.title:Log in · Finance Tracker`,
    component: LoginComponent,
  },
  {
    path: routeSegment(AppRoutesEnum.Register, AppRoutesEnum.Auth),
    title: $localize`:@@auth.register.route.title:Create an account · Finance Tracker`,
    component: RegisterComponent,
  },
];
