import { formatNumber } from '@angular/common';
import { MONEY_LOCALE } from '../locale/locale.constants';
import { MoneyKind } from './money.model';

const MINUS = '\u2212';
const NBSP = '\u00a0';

/**
 * Formats an amount in PLN using Polish conventions regardless of UI language:
 * "1 234,56 zł". Thousands separator and the space before "zł" are non-breaking spaces.
 * Requires the `pl` locale data (registered in `common/locale/locale.utils.ts`).
 */
export function formatMoney(amount: number, kind: MoneyKind = 'plain'): string {
  const value = formatNumber(Math.abs(amount), MONEY_LOCALE, '1.2-2');
  const isZero = value === formatNumber(0, MONEY_LOCALE, '1.2-2');
  const formatted = `${value}${NBSP}zł`;

  switch (kind) {
    case 'expense':
      return isZero ? formatted : `${MINUS}${formatted}`;
    case 'income':
      return isZero ? formatted : `+${formatted}`;
    case 'transfer':
      return formatted;
    case 'plain':
      return amount < 0 && !isZero ? `${MINUS}${formatted}` : formatted;
  }
}
