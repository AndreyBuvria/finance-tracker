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
