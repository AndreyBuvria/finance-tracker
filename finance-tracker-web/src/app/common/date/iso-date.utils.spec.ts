import { parseIsoDate, parseMonthKey, toIsoDate, toMonthKey } from './iso-date.utils';

describe('iso date utils', () => {
  it('writes local calendar dates and months with leading zeros', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toMonthKey(new Date(2026, 9, 19))).toBe('2026-10');
  });

  it('reads real dates only', () => {
    expect(parseIsoDate('2026-10-19')).toEqual(new Date(2026, 9, 19));
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-1-5')).toBeNull();
    expect(parseIsoDate('19.10.2026')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });

  it('reads months only', () => {
    expect(parseMonthKey('2026-10')).toEqual(new Date(2026, 9, 1));
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('2026-00')).toBeNull();
    expect(parseMonthKey('2026-10-01')).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
  });
});
