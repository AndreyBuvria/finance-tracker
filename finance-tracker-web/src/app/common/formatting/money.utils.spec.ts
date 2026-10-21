import '../locale/locale';
import { formatMoney } from './money.utils';

/** Replace non-breaking spaces so expectations stay readable. */
const visible = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  it('formats PLN with Polish separators and "zł" after the amount', () => {
    expect(visible(formatMoney(1234.56))).toBe('1 234,56 zł');
    expect(visible(formatMoney(7500))).toBe('7 500,00 zł');
    expect(visible(formatMoney(1234567.8))).toBe('1 234 567,80 zł');
    expect(visible(formatMoney(18.47))).toBe('18,47 zł');
    expect(visible(formatMoney(0))).toBe('0,00 zł');
  });

  it('uses non-breaking spaces so amounts never wrap', () => {
    expect(formatMoney(1234.56)).toBe('1\u00a0234,56\u00a0zł');
  });

  it('rounds to two decimals', () => {
    expect(visible(formatMoney(2.005))).toBe('2,01 zł');
    expect(visible(formatMoney(0.1 + 0.2))).toBe('0,30 zł');
  });

  it('prefixes expenses with a real minus sign (U+2212)', () => {
    expect(visible(formatMoney(24, 'expense'))).toBe('\u221224,00 zł');
    expect(visible(formatMoney(2800, 'expense'))).toBe('\u22122 800,00 zł');
  });

  it('prefixes income with a plus sign', () => {
    expect(visible(formatMoney(7500, 'income'))).toBe('+7 500,00 zł');
  });

  it('shows transfers without a sign', () => {
    expect(visible(formatMoney(1000, 'transfer'))).toBe('1 000,00 zł');
  });

  it('shows negative plain values (e.g. balances) with a minus sign', () => {
    expect(visible(formatMoney(-412.8))).toBe('\u2212412,80 zł');
  });

  it('never signs a zero amount', () => {
    expect(visible(formatMoney(0, 'expense'))).toBe('0,00 zł');
    expect(visible(formatMoney(0, 'income'))).toBe('0,00 zł');
    expect(visible(formatMoney(-0.001))).toBe('0,00 zł');
  });

  it('ignores the sign of the input for typed amounts', () => {
    expect(visible(formatMoney(-24, 'expense'))).toBe('\u221224,00 zł');
    expect(visible(formatMoney(-1000, 'transfer'))).toBe('1 000,00 zł');
  });
});
