import { Transaction, TransactionPage } from '@common/transactions/transaction.model';

/** What the page gives `TransactionActionsService`: the rows shown and how to update the view. */
export interface TransactionActionsHost {
  /** The page of rows shown now. */
  readonly page: () => TransactionPage | undefined;
  /** Selected rows of that page. */
  readonly selectedRows: () => readonly Transaction[];
  reload(): void;
  clearSelection(): void;
  goToPage(page: number): void;
  /**
   * Moves focus to a stable place after a bulk action removed the focused control (the bulk bar
   * disappears with the selection). `rowsRemoved`: the rows may be gone too, e.g. after a delete.
   */
  focusAfterBulk(rowsRemoved: boolean): void;
}

/** What `TransactionEditorService` needs from the page: reload, and move focus after a removal. */
export type TransactionEditorHost = Pick<TransactionActionsHost, 'reload' | 'focusAfterBulk'>;
