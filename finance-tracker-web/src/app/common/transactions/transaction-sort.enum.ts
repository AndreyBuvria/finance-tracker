/** Sortable columns of `GET /transactions` (PLAN.md §7); `-` before the name sorts descending. */
export enum TransactionSortFieldEnum {
  Date = 'date',
  Amount = 'amount',
  Merchant = 'merchant',
  Category = 'category',
  Account = 'account',
}
