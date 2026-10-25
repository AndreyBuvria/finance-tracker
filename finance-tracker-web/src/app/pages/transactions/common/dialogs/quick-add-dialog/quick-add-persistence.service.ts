import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Transaction } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { TransfersApiService } from '@common/transactions/transfers-api.service';
import { map, Observable } from 'rxjs';
import { QuickAddFormValue } from '../../models/quick-add-form.model';
import { toTransactionRequest, toTransferRequest } from '../../../utils/quick-add-form.utils';
import { selectionTotal } from '../../../utils/transaction-display.utils';
import { DeleteTransactionsDialogComponent } from '../delete-transactions-dialog/delete-transactions-dialog.component';
import { DeleteTransactionsDialogData } from '../delete-transactions-dialog/delete-transactions-dialog.model';

/**
 * The API side of the Quick add / edit dialog: saving the form as a transaction or transfer
 * (create or full replace), and deleting the edited one after the usual confirmation.
 */
@Injectable({ providedIn: 'root' })
export class QuickAddPersistenceService {
  private readonly dialog = inject(MatDialog);
  private readonly transactionsApi = inject(TransactionsApiService);
  private readonly transfersApi = inject(TransfersApiService);

  /** Creates, or replaces `editing`; transfers go through `/transfers`. */
  save(value: QuickAddFormValue, editing: Transaction | null): Observable<Transaction> {
    if (value.type === TransactionTypeEnum.Transfer) {
      const request = toTransferRequest(value);
      const pairId = editing?.transfer?.transferPairId;
      return pairId ? this.transfersApi.update(pairId, request) : this.transfersApi.create(request);
    }
    const request = toTransactionRequest(value);
    return editing
      ? this.transactionsApi.update(editing.id, request)
      : this.transactionsApi.create(request);
  }

  /**
   * Asks "Delete 1 transaction (…)?" (warning when it was imported). Emits whether the user
   * confirmed.
   */
  confirmDelete(transaction: Transaction): Observable<boolean> {
    return this.dialog
      .open<DeleteTransactionsDialogComponent, DeleteTransactionsDialogData, boolean>(
        DeleteTransactionsDialogComponent,
        {
          data: {
            count: 1,
            total: selectionTotal([transaction]),
            includesImported: transaction.source !== TransactionSourceEnum.Manual,
          },
          width: '480px',
          maxWidth: 'calc(100vw - 32px)',
        },
      )
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }

  /** Deletes the transaction; a transfer row deletes the whole pair. */
  delete(transaction: Transaction): Observable<void> {
    return transaction.transfer
      ? this.transfersApi.delete(transaction.transfer.transferPairId)
      : this.transactionsApi.delete(transaction.id);
  }
}
