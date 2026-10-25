/** Where a transaction came from (PLAN.md §5): the "Manual" / "Imported" / "Bank sync" badge. */
export enum TransactionSourceEnum {
  Manual = 'Manual',
  Csv = 'Csv',
  OpenBanking = 'OpenBanking',
}
