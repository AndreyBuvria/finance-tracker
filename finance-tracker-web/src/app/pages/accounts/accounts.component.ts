import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Account } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { errorId, hasStatus } from '@common/http/problem-details.utils';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { registerHeaderActions } from '@infrastructure/layout/header-actions/header-actions.service';
import { LoadErrorComponent } from '@infrastructure/feedback/load-error/load-error.component';
import { catchError, concatMap, defer, EMPTY, finalize, Observable, Subject, tap } from 'rxjs';
import { AccountCardComponent } from './account-card/account-card.component';
import { AccountsSkeletonComponent } from './accounts-skeleton/accounts-skeleton.component';
import { ArchivedAccountsComponent } from './archived-accounts/archived-accounts.component';
import { AccountDialogComponent } from './common/dialogs/account-dialog/account-dialog.component';
import {
  AccountDialogData,
  AccountDialogResult,
} from './common/dialogs/account-dialog/account-dialog.model';

/** Toasts, including "Account archived · Undo" (FEATURES.md F2: 5 seconds). */
const TOAST_DURATION_MS = 5000;

/** An archive or restore request with its messages. */
interface AccountChange {
  readonly account: Account;
  readonly request: () => Observable<void>;
  /** Toast for a 409. */
  readonly conflict: string;
  readonly success: () => void;
}

/**
 * Accounts (FEATURES.md F2, DESIGN.md "Accounts"): net worth, account cards with computed
 * balances, add/edit/archive/restore, and a collapsed archived section.
 * Registers the page's primary "Add" header action (shortcut `N`), which opens "Add account".
 */
@Component({
  selector: 'app-accounts',
  imports: [
    AccountCardComponent,
    LoadErrorComponent,
    AccountsSkeletonComponent,
    ArchivedAccountsComponent,
    MatButtonModule,
    MatIconModule,
    MoneyPipe,
  ],
  templateUrl: './accounts.component.html',
  styleUrls: ['./common/styles/account-grid.scss', './accounts.component.scss'],
})
export class AccountsComponent {
  private readonly api = inject(AccountsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  /** Active and archived accounts; net worth covers active ones only (API). */
  readonly accounts = rxResource({ stream: () => this.api.list(true) });

  readonly active = computed(() =>
    this.accounts.hasValue() ? this.accounts.value().items.filter((a) => !a.isArchived) : [],
  );
  readonly archived = computed(() =>
    this.accounts.hasValue() ? this.accounts.value().items.filter((a) => a.isArchived) : [],
  );
  readonly loadErrorId = computed(() => errorId(this.accounts.error()));

  /** Account with an archive/restore request in flight. */
  readonly busyId = signal<string | null>(null);
  /** While any change runs, every card's actions are disabled. */
  readonly busy = computed(() => this.busyId() !== null);

  /**
   * Archive/restore requests run one at a time, in order. The card buttons are disabled while one
   * runs, so only a toast's "Undo" can arrive meanwhile; it waits its turn instead of being dropped.
   */
  private readonly changes = new Subject<AccountChange>();

  constructor() {
    this.changes
      .pipe(
        concatMap((change) => this.execute(change)),
        takeUntilDestroyed(),
      )
      .subscribe();

    registerHeaderActions([
      {
        id: 'add-account',
        label: $localize`:@@accounts.action.add:Add`,
        accessibleLabel: $localize`:@@accounts.action.add.label:Add account`,
        icon: 'add',
        shortcut: 'N',
        primary: true,
        handler: () => this.openDialog(),
      },
    ]);
  }

  openDialog(account?: Account): void {
    this.dialog
      .open<AccountDialogComponent, AccountDialogData, AccountDialogResult>(
        AccountDialogComponent,
        { data: { account }, width: '480px', maxWidth: 'calc(100vw - 32px)' },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if (result.status === 'notFound') {
          // Deleted or changed elsewhere: same as a 404 on archive/restore.
          this.toast($localize`:@@common.error.generic:Something went wrong. Try again.`);
          this.accounts.reload();
          return;
        }
        this.toast(
          account
            ? $localize`:@@accounts.toast.updated:Account updated`
            : $localize`:@@accounts.toast.added:Account added`,
        );
        this.accounts.reload();
      });
  }

  archive(account: Account): void {
    this.changes.next({
      account,
      request: () => this.api.archive(account.id),
      conflict: $localize`:@@accounts.error.lastActive:You need at least one active account.`,
      success: () => {
        const undo = $localize`:@@common.action.undo:Undo`;
        this.snackBar
          .open($localize`:@@accounts.toast.archived:Account archived`, undo, {
            duration: TOAST_DURATION_MS,
          })
          .onAction()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.restore(account));
      },
    });
  }

  restore(account: Account): void {
    this.changes.next({
      account,
      request: () => this.api.restore(account.id),
      conflict: $localize`:@@accounts.error.restoreNameTaken:An account with this name already exists. Rename it first.`,
      success: () => this.toast($localize`:@@accounts.toast.restored:Account restored`),
    });
  }

  /** Runs one archive/restore: toast, then reload the list. Errors end here (toast). */
  private execute(change: AccountChange): Observable<void> {
    return defer(() => {
      this.busyId.set(change.account.id);
      return change.request();
    }).pipe(
      tap(() => {
        change.success();
        this.accounts.reload();
      }),
      catchError((error: unknown) => {
        this.toast(
          hasStatus(error, 409)
            ? change.conflict
            : $localize`:@@common.error.generic:Something went wrong. Try again.`,
        );
        // A 404 means it changed elsewhere; show the current state.
        if (hasStatus(error, 404)) {
          this.accounts.reload();
        }
        return EMPTY;
      }),
      finalize(() => this.busyId.set(null)),
    );
  }

  private toast(message: string): void {
    this.snackBar.open(message, undefined, { duration: TOAST_DURATION_MS });
  }
}
