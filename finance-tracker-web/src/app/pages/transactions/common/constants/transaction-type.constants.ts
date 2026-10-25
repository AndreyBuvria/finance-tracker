import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';

/** Labels of the transaction types (FEATURES.md F3/F4: Expense / Income / Transfer). */
export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionTypeEnum, string>> = {
  [TransactionTypeEnum.Expense]: $localize`:@@transactions.type.expense:Expense`,
  [TransactionTypeEnum.Income]: $localize`:@@transactions.type.income:Income`,
  [TransactionTypeEnum.Transfer]: $localize`:@@transactions.type.transfer:Transfer`,
};

/** Type filter options in display order. */
export const TRANSACTION_TYPES: readonly TransactionTypeEnum[] = [
  TransactionTypeEnum.Expense,
  TransactionTypeEnum.Income,
  TransactionTypeEnum.Transfer,
];
