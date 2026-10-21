import { formatNumber } from '@angular/common';

/**
 * How an amount is shown:
 * - `expense`: "−120,00 zł" (U+2212 minus; pair with a red accent in the UI)
 * - `income`: "+7 500,00 zł" (pair with green)
 * - `transfer`: "1 000,00 zł" (neutral, no sign)
 * - `plain` (default): no sign for positive values, "−" for negative (e.g. balances)
 *
 * API amounts are always positive; the transaction type decides the sign.
 */
export type MoneyKind = 'expense' | 'income' | 'transfer' | 'plain';

const MINUS = '\u2212';
const NBSP = '\u00a0';

/**
 * Formats an amount in PLN using Polish conventions regardless of UI language:
 * "1 234,56 zł". Thousands separator and the space before "zł" are non-breaking spaces.
 * Requires the `pl` locale data (registered in `common/locale/locale.ts`).
 */
export function formatMoney(amount: number, kind: MoneyKind = 'plain'): string {
  const value = formatNumber(Math.abs(amount), 'pl', '1.2-2');
  const isZero = value === formatNumber(0, 'pl', '1.2-2');
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
