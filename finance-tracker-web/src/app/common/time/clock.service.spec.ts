import { TestBed } from '@angular/core/testing';
import { ClockService } from './clock.service';
import { FakeClockService, provideFakeClock } from './testing/fake-clock.service';

describe('ClockService', () => {
  it('returns the current system time from now()', () => {
    const clock = TestBed.inject(ClockService);
    const before = Date.now();
    const now = clock.now().getTime();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('returns today at local midnight', () => {
    const clock = TestBed.inject(ClockService);
    const today = clock.today();

    expect([
      today.getHours(),
      today.getMinutes(),
      today.getSeconds(),
      today.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
    expect(today.getDate()).toBe(clock.now().getDate());
  });
});

describe('FakeClockService', () => {
  it('is used when provided with provideFakeClock', () => {
    TestBed.configureTestingModule({ providers: [provideFakeClock('2026-10-19T15:30:00')] });
    const clock = TestBed.inject(ClockService);

    expect(clock).toBeInstanceOf(FakeClockService);
    expect(clock.now()).toEqual(new Date(2026, 9, 19, 15, 30));
    expect(clock.today()).toEqual(new Date(2026, 9, 19));
  });

  it('can be moved with set() and advanceBy()', () => {
    const fake = new FakeClockService('2026-10-19T23:30:00');
    TestBed.configureTestingModule({ providers: [provideFakeClock(fake)] });
    const clock = TestBed.inject(ClockService);

    fake.advanceBy(60 * 60 * 1000);
    expect(clock.today()).toEqual(new Date(2026, 9, 20));

    fake.set('2026-01-01T08:00:00');
    expect(clock.now()).toEqual(new Date(2026, 0, 1, 8));
  });

  it('returns a copy so callers cannot mutate the fake time', () => {
    const fake = new FakeClockService('2026-10-19T10:00:00');
    fake.now().setFullYear(2000);

    expect(fake.now().getFullYear()).toBe(2026);
  });
});
