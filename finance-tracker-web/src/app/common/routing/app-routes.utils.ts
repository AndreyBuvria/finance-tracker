import { AppRoutesEnum } from './app-routes.enum';

/**
 * The `path` of `route` in a route config: relative to `parent` when the route is a child of
 * a lazy-loaded feature (`routeSegment(AppRoutesEnum.Login, AppRoutesEnum.Auth)` → `'login'`),
 * otherwise relative to the root (`routeSegment(AppRoutesEnum.Dashboard)` → `'dashboard'`).
 */
export function routeSegment(route: AppRoutesEnum, parent?: AppRoutesEnum): string {
  const prefix = `${parent ?? ''}/`;
  if (!route.startsWith(prefix)) {
    throw new Error(`Route "${route}" is not under "${parent}".`);
  }
  return route.slice(prefix.length);
}
