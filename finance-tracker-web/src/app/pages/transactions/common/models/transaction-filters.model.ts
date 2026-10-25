import { TransactionSort } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';

/**
 * The Transactions page state kept in the URL query params (FEATURES.md F3 "Filters are stored in
 * the URL"), already validated. Empty filters are null / empty.
 */
export interface TransactionFilters {
  /**
   * First day of the month (URL: "YYYY-MM"); the current month when the URL has none. Ignored while
   * a date range is set.
   */
  readonly month: Date;
  /** Date range ("YYYY-MM-DD"); replaces the month while either end is set. */
  readonly from: string | null;
  readonly to: string | null;
  readonly accountId: string | null;
  readonly categoryIds: readonly string[];
  readonly type: TransactionTypeEnum | null;
  readonly minAmount: number | null;
  readonly maxAmount: number | null;
  /** Trimmed search text; '' when none. */
  readonly q: string;
  /** 1-based. */
  readonly page: number;
  readonly sort: TransactionSort;
}

/** A change to some of the filters. */
export type TransactionFiltersChange = Partial<TransactionFilters>;
