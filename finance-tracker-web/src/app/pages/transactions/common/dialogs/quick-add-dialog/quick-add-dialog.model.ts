import { Transaction } from '@common/transactions/transaction.model';

export interface QuickAddDialogData {
  /** The transaction to edit; none for Quick add. */
  readonly transaction?: Transaction;
}

/**
 * How the dialog closed (closing without a result = cancelled). New transactions are reported one
 * by one through the component's `added` output (also for "Save and add another").
 */
export type QuickAddDialogResult =
  | { readonly status: 'updated'; readonly transaction: Transaction }
  | { readonly status: 'deleted'; readonly transaction: Transaction }
  /** The edited transaction no longer exists. */
  | { readonly status: 'notFound' };
