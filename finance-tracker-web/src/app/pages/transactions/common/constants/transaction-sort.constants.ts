import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';

/** Column names for the sort announcement, as in the table headers. */
export const SORT_COLUMN_LABELS: Readonly<Record<TransactionSortFieldEnum, string>> = {
  [TransactionSortFieldEnum.Date]: $localize`:@@transactions.sort.column.date:Date`,
  [TransactionSortFieldEnum.Merchant]: $localize`:@@transactions.sort.column.merchant:Merchant/Note`,
  [TransactionSortFieldEnum.Category]: $localize`:@@transactions.sort.column.category:Category`,
  [TransactionSortFieldEnum.Account]: $localize`:@@transactions.sort.column.account:Account`,
  [TransactionSortFieldEnum.Amount]: $localize`:@@transactions.sort.column.amount:Amount`,
};
