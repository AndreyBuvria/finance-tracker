import { TransactionSort } from '@common/transactions/transaction.model';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';

/** Server-side paging (PLAN.md §8: 50 per page). */
export const TRANSACTIONS_PAGE_SIZE = 50;

/** Newest first. */
export const DEFAULT_TRANSACTION_SORT: TransactionSort = `-${TransactionSortFieldEnum.Date}`;

/** PLAN.md §7: `q` is at most 100 characters. */
export const SEARCH_MAX_LENGTH = 100;

/** Wait for a pause in typing before searching. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Wait for a pause in typing before applying an amount range. */
export const AMOUNT_DEBOUNCE_MS = 500;

/** How long the inline "Saved" confirmation stays. */
export const SAVED_CONFIRMATION_MS = 3000;

/** Toasts (FEATURES.md §3). */
export const TOAST_DURATION_MS = 5000;

/** Query param names of the page state (FEATURES.md F3: filters are stored in the URL). */
export const TRANSACTION_QUERY_PARAMS = {
  month: 'month',
  from: 'from',
  to: 'to',
  account: 'account',
  category: 'category',
  type: 'type',
  min: 'min',
  max: 'max',
  q: 'q',
  page: 'page',
  sort: 'sort',
} as const;
