import { addMonths, endOfMonth, startOfMonth } from './month.utils';

describe('month utils', () => {
  it('returns the first day of the month at midnight', () => {
    expect(startOfMonth(new Date(2026, 9, 19, 15, 30))).toEqual(new Date(2026, 9, 1));
  });

  it('moves by whole months across year boundaries', () => {
    expect(addMonths(new Date(2026, 9, 1), 1)).toEqual(new Date(2026, 10, 1));
    expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
    expect(addMonths(new Date(2026, 0, 1), -1)).toEqual(new Date(2025, 11, 1));
  });

  it('never overflows into the following month from a long month', () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });

  it('returns the last day of the month, also in February and December', () => {
    expect(endOfMonth(new Date(2026, 9, 19))).toEqual(new Date(2026, 9, 31));
    expect(endOfMonth(new Date(2028, 1, 1))).toEqual(new Date(2028, 1, 29));
    expect(endOfMonth(new Date(2026, 11, 5))).toEqual(new Date(2026, 11, 31));
  });
});
