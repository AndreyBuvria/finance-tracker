import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Base URL for all API calls, e.g. `${inject(API_BASE_URL)}/accounts`.
 * `/api` everywhere: `ng serve` proxies it to the local API (proxy.conf.json).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
