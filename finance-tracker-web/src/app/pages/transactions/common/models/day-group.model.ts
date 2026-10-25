import { Transaction } from '@common/transactions/transaction.model';

/** A run of rows on the same day (mobile list), with the day's net amount. */
export interface DayGroup {
  /** "YYYY-MM-DD". */
  readonly date: string;
  readonly items: readonly Transaction[];
  /** Income − expenses of the rows; transfers add nothing. */
  readonly total: number;
}
