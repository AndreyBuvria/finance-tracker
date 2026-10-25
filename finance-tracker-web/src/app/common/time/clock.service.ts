import { Injectable } from '@angular/core';
import { BUSINESS_TIME_ZONE } from './time.constants';

const BUSINESS_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

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

  /**
   * Today's calendar date in Europe/Warsaw (PLAN.md §6 "Dates"), at local midnight, whatever the
   * browser's time zone. Use it for business dates such as the default month.
   */
  businessToday(): Date {
    const parts = BUSINESS_DATE_FORMAT.formatToParts(this.now());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    return new Date(part('year'), part('month') - 1, part('day'));
  }
}
