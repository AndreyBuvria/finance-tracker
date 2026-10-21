import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marks the auth endpoints themselves (register, login, refresh, logout). The auth interceptor
 * leaves them untouched: no bearer token added, no refresh or redirect on 401
 * (a 401 from login means "Email or password is incorrect.").
 */
export const AUTH_ENDPOINT = new HttpContextToken<boolean>(() => false);

export function authEndpointContext(): HttpContext {
  return new HttpContext().set(AUTH_ENDPOINT, true);
}
