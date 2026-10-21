/**
 * Every route of the app, as absolute URLs. Use them for links, navigation and redirects
 * (`routerLink`, `router.navigate`, `createUrlTree`). Route configs take their `path` from
 * `routeSegment()` (`app-routes.utils.ts`), so each path is written only here.
 */
export enum AppRoutesEnum {
  Auth = '/auth',
  Login = '/auth/login',
  Register = '/auth/register',
  Onboarding = '/onboarding',
  Dashboard = '/dashboard',
  Transactions = '/transactions',
  Accounts = '/accounts',
  Settings = '/settings',
}
