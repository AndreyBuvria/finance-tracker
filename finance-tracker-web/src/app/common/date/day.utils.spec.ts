import { addDays, isSameDay } from './day.utils';

describe('day utils', () => {
  it('moves by calendar days across month and year ends', () => {
    expect(addDays(new Date(2026, 9, 31), 1)).toEqual(new Date(2026, 10, 1));
    expect(addDays(new Date(2026, 0, 1, 15), -1)).toEqual(new Date(2025, 11, 31));
  });

  it('compares calendar days', () => {
    expect(isSameDay(new Date(2026, 9, 19, 8), new Date(2026, 9, 19, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 19), new Date(2026, 9, 20))).toBe(false);
    expect(isSameDay(null, new Date())).toBe(false);
  });
});
