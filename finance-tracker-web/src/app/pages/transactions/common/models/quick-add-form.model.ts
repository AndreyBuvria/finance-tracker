import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';

/** Raw value of the quick add / edit form. Text fields hold what the user typed. */
export interface QuickAddFormValue {
  readonly type: TransactionTypeEnum;
  /** "12,50" or "12.50". */
  readonly amount: string;
  readonly categoryId: string;
  readonly merchant: string;
  readonly note: string;
  readonly date: Date | null;
  readonly accountId: string;
  readonly fromAccountId: string;
  readonly toAccountId: string;
}
