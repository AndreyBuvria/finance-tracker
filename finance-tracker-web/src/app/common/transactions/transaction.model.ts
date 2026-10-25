import { CategoryTypeEnum } from '../categories/category-type.enum';
import { BulkTransactionActionEnum } from './bulk-transaction-action.enum';
import { TransactionSourceEnum } from './transaction-source.enum';
import { TransactionSortFieldEnum } from './transaction-sort.enum';
import { TransactionTypeEnum } from './transaction-type.enum';

/*
 * PLAN.md §7 "Transactions contract (agreed)" and "Transfers contract (agreed)". Routes used so far
 * (under /api):
 * - GET /transactions?from&to&accountId&categoryId(repeated)&type&minAmount&maxAmount&q&page&pageSize&sort
 *   → 200 TransactionPage; 400 validation
 * - POST /transactions/bulk BulkTransactionRequest → 200 { affectedCount }, all or nothing; 400
 *   validation (e.g. transfers selected for Recategorize); 404 when any id is unknown
 * - GET /transactions/merchants?q=&limit=10 → 200 MerchantList
 * - POST /transactions TransactionRequest → 201 Transaction; 400 validation; 404 account/category
 * - PUT /transactions/{id} TransactionRequest (full replace) → 200; 409 for a transfer row; 404
 * - DELETE /transactions/{id} → 204 (a transfer row deletes the pair); 404
 * - POST /transfers TransferRequest → 201 Transaction (the Out row); 400; 404
 * - PUT /transfers/{transferPairId} TransferRequest → 200; 404
 * - DELETE /transfers/{transferPairId} → 204; 404
 */

/** An account as shown on a transaction row. */
export interface TransactionAccount {
  id: string;
  name: string;
  isArchived: boolean;
}

/** A category as shown on a transaction row (chip with icon and color). */
export interface TransactionCategory {
  id: string;
  name: string;
  type: CategoryTypeEnum;
  icon: string;
  /** Lowercase `#rrggbb`. */
  color: string;
  systemKey: string | null;
  isArchived: boolean;
}

/** Both sides of a transfer, shown as one row "From → To". */
export interface TransferInfo {
  /** For `PUT/DELETE /transfers/{transferPairId}`. */
  transferPairId: string;
  fromAccount: TransactionAccount;
  toAccount: TransactionAccount;
}

/** The import batch of an imported transaction. */
export interface TransactionImportInfo {
  batchId: string;
  /** ISO timestamp. */
  importedAt: string;
}

/**
 * One row of the transactions table. A transfer is one row (its Out side) with `transfer` set,
 * `category` null and `account` = the source account.
 */
export interface Transaction {
  /** For a transfer: the ID of its Out row. */
  id: string;
  type: TransactionTypeEnum;
  /** Always positive; `type` decides the sign. */
  amount: number;
  /** "YYYY-MM-DD". */
  date: string;
  merchant: string | null;
  note: string | null;
  source: TransactionSourceEnum;
  account: TransactionAccount;
  category: TransactionCategory | null;
  transfer: TransferInfo | null;
  import: TransactionImportInfo | null;
  /** Imported into "Other" / "Other income": highlight it ("Needs category"). */
  needsCategory: boolean;
}

/** Footer totals over the whole filtered set (all pages). Transfers count as rows but add no money. */
export interface TransactionTotals {
  /** Income in income categories. */
  income: number;
  /** "Spent": expenses minus refunds, never below 0. */
  expenses: number;
  /** `income` − `expenses`. */
  net: number;
}

export interface TransactionPage {
  items: Transaction[];
  page: number;
  pageSize: number;
  /** Rows matching the filters; a transfer counts once. */
  totalCount: number;
  /** 0 when nothing matches. */
  totalPages: number;
  totals: TransactionTotals;
}

/** `sort` of `GET /transactions`: a field, optionally prefixed with `-` for descending. */
export type TransactionSort = `${TransactionSortFieldEnum}` | `-${TransactionSortFieldEnum}`;

/** Query of `GET /transactions`. Every filter is optional; there is no default month. */
export interface TransactionListQuery {
  /** First date included, "YYYY-MM-DD". */
  from?: string | null;
  /** Last date included, "YYYY-MM-DD". */
  to?: string | null;
  /** Also matches a transfer whose other side is this account. */
  accountId?: string | null;
  /** Any of these categories (multi-select). */
  categoryIds?: readonly string[];
  type?: TransactionTypeEnum | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  /** Merchant and note, case- and accent-insensitive, at most 100 characters. */
  q?: string | null;
  /** 1-based. */
  page?: number;
  /** 1–200, default 50. */
  pageSize?: number;
  sort?: TransactionSort;
}

export interface BulkTransactionRequest {
  action: BulkTransactionActionEnum;
  /** 1–500 IDs. Delete removes transfer pairs whole. */
  transactionIds: readonly string[];
  /** Required for Recategorize. */
  categoryId?: string;
}

export interface BulkTransactionResult {
  /** Rows deleted or recategorized (a transfer pair counts once). */
  affectedCount: number;
}

/** Body of `POST /transactions` and `PUT /transactions/{id}` (expenses and income only). */
export interface TransactionRequest {
  type: TransactionTypeEnum.Expense | TransactionTypeEnum.Income;
  /** Positive, at most 2 decimals. */
  amount: number;
  /** "YYYY-MM-DD", at most tomorrow (Europe/Warsaw). */
  date: string;
  accountId: string;
  categoryId: string;
  /** Trimmed by the API; blank = none. At most 200 characters. */
  merchant: string | null;
  /** At most 500 characters. PUT is a full replace, so send the current note. */
  note: string | null;
}

/** Body of `POST /transfers` and `PUT /transfers/{transferPairId}`. */
export interface TransferRequest {
  fromAccountId: string;
  /** Must differ from `fromAccountId`. */
  toAccountId: string;
  amount: number;
  date: string;
  note: string | null;
}

/** A past merchant for autocomplete. */
export interface MerchantSuggestion {
  merchant: string;
  /** "YYYY-MM-DD". */
  lastUsedOn: string;
  /** Newest still-active category used with this merchant. */
  lastCategory: TransactionCategory | null;
}

export interface MerchantList {
  items: MerchantSuggestion[];
}
