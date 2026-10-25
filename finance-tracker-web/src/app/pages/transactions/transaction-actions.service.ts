import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category } from '@common/categories/category.model';
import { BulkTransactionActionEnum } from '@common/transactions/bulk-transaction-action.enum';
import { BulkTransactionRequest, Transaction } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import {
  catchError,
  concat,
  EMPTY,
  filter,
  finalize,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import {
  SAVED_CONFIRMATION_MS,
  TOAST_DURATION_MS,
} from './common/constants/transactions-page.constants';
import { DeleteTransactionsDialogComponent } from './common/dialogs/delete-transactions-dialog/delete-transactions-dialog.component';
import { DeleteTransactionsDialogData } from './common/dialogs/delete-transactions-dialog/delete-transactions-dialog.model';
import { CategoryChange } from './common/models/category-change.model';
import { TransactionActionsHost } from './common/models/transaction-actions-host.model';
import { bulkErrorMessage } from './utils/bulk-error.utils';
import { selectionTotal } from './utils/transaction-display.utils';

/**
 * Changes made from the Transactions page (FEATURES.md F3): inline category change with "Saved",
 * and bulk recategorize/delete with confirmation, toasts and focus handling. The page keeps the URL
 * state and connects itself as the host.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- page-scoped: TransactionsComponent provides it, so its state starts and ends with the page.
@Injectable()
export class TransactionActionsService {
  private readonly api = inject(TransactionsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly destroyRef = inject(DestroyRef);
  private host: TransactionActionsHost | null = null;

  /** Rows whose inline category change is being saved. */
  readonly savingIds = signal<ReadonlySet<string>>(new Set());
  /** A bulk action is running. */
  readonly busy = signal(false);

  private readonly saved$ = new Subject<string>();
  /** Row showing "Saved" for a moment after an inline change. */
  readonly savedId = toSignal(
    this.saved$.pipe(
      switchMap((id) =>
        concat(of(id), timer(SAVED_CONFIRMATION_MS).pipe(map((): string | null => null))),
      ),
    ),
    { initialValue: null },
  );

  connect(host: TransactionActionsHost): void {
    this.host = host;
  }

  /** Inline category change: saved immediately, then "Saved". Focus stays on the chip. */
  changeCategory({ transaction, category }: CategoryChange): void {
    const id = transaction.id;
    if (this.savingIds().has(id)) {
      return;
    }
    this.savingIds.update((ids) => new Set(ids).add(id));
    this.run(
      {
        action: BulkTransactionActionEnum.Recategorize,
        transactionIds: [id],
        categoryId: category.id,
      },
      true,
      () =>
        this.savingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        }),
    ).subscribe(() => {
      this.saved$.next(id);
      this.announcer.announce($localize`:@@transactions.category.saved:Saved`);
      this.host?.reload();
    });
  }

  /** "Change category" with a transfer selected (PLAN.md §7 bulk message). */
  explainTransfers(): void {
    this.toast(
      $localize`:@@transactions.bulk.transfersNoCategory:Transfers don't have a category. Unselect them first.`,
    );
  }

  recategorizeSelected(category: Category): void {
    const rows = this.host?.selectedRows() ?? [];
    if (this.busy() || rows.length === 0) {
      return;
    }
    this.busy.set(true);
    this.run(
      {
        action: BulkTransactionActionEnum.Recategorize,
        transactionIds: rows.map((row) => row.id),
        categoryId: category.id,
      },
      false,
      () => this.busy.set(false),
    ).subscribe(() => {
      this.host?.clearSelection();
      this.host?.focusAfterBulk(false);
      this.toast($localize`:@@transactions.toast.recategorized:Category changed`);
      this.host?.reload();
    });
  }

  /** Confirms with the count and total, then deletes (FEATURES.md F3). */
  deleteSelected(): void {
    const rows = this.host?.selectedRows() ?? [];
    if (this.busy() || rows.length === 0) {
      return;
    }
    this.dialog
      .open<DeleteTransactionsDialogComponent, DeleteTransactionsDialogData, boolean>(
        DeleteTransactionsDialogComponent,
        {
          data: {
            count: rows.length,
            total: selectionTotal(rows),
            includesImported: rows.some((row) => row.source !== TransactionSourceEnum.Manual),
          },
          width: '480px',
          maxWidth: 'calc(100vw - 32px)',
        },
      )
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => {
          this.busy.set(true);
          return this.run(
            {
              action: BulkTransactionActionEnum.Delete,
              transactionIds: rows.map((row) => row.id),
            },
            false,
            () => this.busy.set(false),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.afterDelete(rows));
  }

  private afterDelete(rows: readonly Transaction[]): void {
    const host = this.host;
    host?.clearSelection();
    host?.focusAfterBulk(true);
    this.toast(
      rows.length === 1
        ? $localize`:@@transactions.toast.deletedOne:Transaction deleted`
        : $localize`:@@transactions.toast.deletedMany:Transactions deleted`,
    );
    const page = host?.page();
    // The whole last page is gone: show the one before it.
    if (page && page.page > 1 && rows.length >= page.items.length) {
      host?.goToPage(page.page - 1);
    } else {
      host?.reload();
    }
  }

  /**
   * Runs a bulk request. Errors end here with a toast and a reload (the list may have changed
   * elsewhere); emits once on success.
   */
  private run(
    request: BulkTransactionRequest,
    singleRow: boolean,
    done: () => void,
  ): Observable<void> {
    return this.api.bulk(request).pipe(
      map(() => undefined),
      catchError((error: unknown) => {
        this.toast(bulkErrorMessage(error, singleRow));
        this.host?.reload();
        return EMPTY;
      }),
      finalize(done),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /** Toasts are announced by the snack bar itself. */
  private toast(message: string): void {
    this.snackBar.open(message, undefined, { duration: TOAST_DURATION_MS });
  }
}
