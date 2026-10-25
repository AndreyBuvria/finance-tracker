import { Component, computed, input } from '@angular/core';
import { Transaction, TransactionAccount } from '@common/transactions/transaction.model';

/**
 * The account of a row, or "mBank card → Savings" for a transfer, each with an "Archived" badge
 * when that account is archived (FEATURES.md F2: archived accounts stay in history with a badge).
 */
@Component({
  selector: 'app-account-label',
  template: `
    @for (account of accounts(); track account.id; let last = $last) {
      <span class="account">
        {{ account.name }}
        @if (account.isArchived) {
          <span class="badge" i18n="@@common.badge.archived">Archived</span>
        }
      </span>
      @if (!last) {
        <span class="arrow" aria-hidden="true">→</span>
        <span class="visually-hidden" i18n="@@transactions.transfer.to">to</span>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 6px;
    }

    .account {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge {
      padding: 0 6px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
      white-space: nowrap;
    }
  `,
})
export class AccountLabelComponent {
  readonly transaction = input.required<Transaction>();

  /** One account, or the transfer's from and to accounts. */
  readonly accounts = computed<readonly TransactionAccount[]>(() => {
    const transaction = this.transaction();
    return transaction.transfer
      ? [transaction.transfer.fromAccount, transaction.transfer.toAccount]
      : [transaction.account];
  });
}
