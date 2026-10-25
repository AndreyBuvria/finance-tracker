import { BreakpointObserver } from '@angular/cdk/layout';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { hasStatus } from '@common/http/problem-details.utils';
import { Transaction } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { TransfersApiService } from '@common/transactions/transfers-api.service';
import { DESKTOP_QUERY } from '@infrastructure/layout/layout.constants';
import { Observable, switchMap } from 'rxjs';
import { TOAST_DURATION_MS } from './common/constants/transactions-page.constants';
import { QuickAddDialogComponent } from './common/dialogs/quick-add-dialog/quick-add-dialog.component';
import {
  QuickAddDialogData,
  QuickAddDialogResult,
} from './common/dialogs/quick-add-dialog/quick-add-dialog.model';
import { TransactionEditorHost } from './common/models/transaction-actions-host.model';
import { addedMessage } from './utils/added-message.utils';

/**
 * Opens Quick add and the edit dialog for the Transactions page (FEATURES.md F3): toasts with Undo
 * for each added transaction (Undo deletes it), "updated"/"deleted" toasts after editing, and a
 * reload of the list after every change. Centered dialog on desktop, full-screen sheet on mobile.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- page-scoped: TransactionsComponent provides it, so its state starts and ends with the page.
@Injectable()
export class TransactionEditorService {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly transactionsApi = inject(TransactionsApiService);
  private readonly transfersApi = inject(TransfersApiService);
  private readonly destroyRef = inject(DestroyRef);
  private host: TransactionEditorHost | null = null;

  connect(host: TransactionEditorHost): void {
    this.host = host;
  }

  /**
   * @param refocus The control that opened it disappears once something is added (the "Add
   *   transaction" button of the empty state): move focus to the page afterwards.
   */
  openQuickAdd(refocus = false): void {
    if (this.dialog.openDialogs.length > 0) {
      return;
    }
    const ref = this.open({});
    let addedAny = false;
    ref.componentInstance.added.subscribe((transaction) => {
      addedAny = true;
      this.afterAdd(transaction);
    });
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (refocus && addedAny) {
          this.host?.focusAfterBulk(false);
        }
      });
  }

  openEdit(transaction: Transaction): void {
    this.open({ transaction })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.toast(this.resultMessage(result));
        this.host?.reload();
        // The row focus would return to is gone (deleted) or unknown (deleted elsewhere).
        if (result.status !== 'updated') {
          this.host?.focusAfterBulk(true);
        }
      });
  }

  private open(data: QuickAddDialogData) {
    const desktop = this.breakpoints.isMatched(DESKTOP_QUERY);
    const config: MatDialogConfig<QuickAddDialogData> = desktop
      ? { data, width: '560px', maxWidth: 'calc(100vw - 32px)', autoFocus: false }
      : {
          data,
          width: '100vw',
          maxWidth: '100vw',
          height: '100dvh',
          position: { bottom: '0' },
          panelClass: 'app-sheet-dialog',
          autoFocus: false,
        };
    return this.dialog.open<QuickAddDialogComponent, QuickAddDialogData, QuickAddDialogResult>(
      QuickAddDialogComponent,
      config,
    );
  }

  private afterAdd(transaction: Transaction): void {
    this.host?.reload();
    this.snackBar
      .open(addedMessage(transaction), $localize`:@@common.action.undo:Undo`, {
        duration: TOAST_DURATION_MS,
      })
      .onAction()
      .pipe(
        switchMap(() => this.remove(transaction)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast(
            transaction.transfer
              ? $localize`:@@transactions.toast.transferRemoved:Transfer removed`
              : $localize`:@@transactions.toast.removed:Transaction removed`,
          );
          this.host?.reload();
        },
        error: (error: unknown) => {
          // Already gone (404): the list just needs to show it.
          if (!hasStatus(error, 404)) {
            this.toast($localize`:@@common.error.generic:Something went wrong. Try again.`);
          }
          this.host?.reload();
        },
      });
  }

  private remove(transaction: Transaction): Observable<void> {
    return transaction.transfer
      ? this.transfersApi.delete(transaction.transfer.transferPairId)
      : this.transactionsApi.delete(transaction.id);
  }

  private resultMessage(result: QuickAddDialogResult): string {
    switch (result.status) {
      case 'updated':
        return result.transaction.type === TransactionTypeEnum.Transfer
          ? $localize`:@@transactions.toast.transferUpdated:Transfer updated`
          : $localize`:@@transactions.toast.updated:Transaction updated`;
      case 'deleted':
        return $localize`:@@transactions.toast.deletedOne:Transaction deleted`;
      case 'notFound':
        return $localize`:@@common.error.generic:Something went wrong. Try again.`;
    }
  }

  private toast(message: string): void {
    this.snackBar.open(message, undefined, { duration: TOAST_DURATION_MS });
  }
}
