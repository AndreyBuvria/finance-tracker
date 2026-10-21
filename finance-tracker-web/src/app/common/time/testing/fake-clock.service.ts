import { Provider } from '@angular/core';
import { ClockService } from '../clock.service';

/** Test double for `ClockService` with a settable "now". */
export class FakeClockService extends ClockService {
  private current: Date;

  constructor(initial: Date | string) {
    super();
    this.current = new Date(initial);
  }

  override now(): Date {
    return new Date(this.current);
  }

  set(value: Date | string): void {
    this.current = new Date(value);
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

/**
 * Replaces `ClockService` in a TestBed. Inject `ClockService` and cast to `FakeClockService`
 * (or keep a reference to the instance passed here) to move time in a test.
 *
 * @example TestBed.configureTestingModule({ providers: [provideFakeClock('2026-10-19T10:00:00')] });
 */
export function provideFakeClock(initial: Date | string | FakeClockService): Provider {
  const clock = initial instanceof FakeClockService ? initial : new FakeClockService(initial);
  return { provide: ClockService, useValue: clock };
}
