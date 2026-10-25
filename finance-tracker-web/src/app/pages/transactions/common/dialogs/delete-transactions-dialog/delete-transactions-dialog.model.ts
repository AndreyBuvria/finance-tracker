import { SignedTotal } from '../../models/signed-total.model';

export interface DeleteTransactionsDialogData {
  readonly count: number;
  /** Shown in the title: "(−212,00 zł)". */
  readonly total: SignedTotal;
  /** Some selected rows were imported: deleting them is permanent for re-imports. */
  readonly includesImported: boolean;
}
