import { Injectable } from '@angular/core';

/**
 * The only place in the app allowed to read the current date/time.
 * Everything else injects `ClockService`, so tests can control "today"
 * with `provideFakeClock()` from `common/time/testing`.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  /** Current instant. */
  now(): Date {
    // eslint-disable-next-line no-restricted-syntax -- the single allowed reader of the system clock
    return new Date();
  }

  /** Today at local midnight (00:00:00.000). */
  today(): Date {
    const now = this.now();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
