import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Empty states (FEATURES.md F3): no transactions at all ("Add transaction" opens Quick add;
 * "Import statement" is disabled with "Coming soon" until Phase 4), or nothing matches the filters
 * (with "Clear filters" when there is a filter to clear).
 */
@Component({
  selector: 'app-transactions-empty',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="empty">
      @if (kind() === 'none') {
        <mat-icon class="illustration" aria-hidden="true">receipt_long</mat-icon>
        <p class="message" i18n="@@transactions.empty.none">
          No transactions yet. Add your first one or import a bank statement.
        </p>
        <div class="actions">
          <button matButton="filled" type="button" (click)="addRequested.emit()">
            <mat-icon aria-hidden="true">add</mat-icon>
            <span i18n="@@transactions.action.add.label">Add transaction</span>
          </button>
          <!-- CSV import arrives with Phase 4 (FEATURES.md F3 empty states). -->
          <button matButton="outlined" type="button" disabled>
            <mat-icon aria-hidden="true">upload_file</mat-icon>
            <span i18n="@@transactions.empty.import">Import statement</span>
            <span class="badge" i18n="@@common.badge.comingSoon">Coming soon</span>
          </button>
        </div>
      } @else {
        <mat-icon class="illustration" aria-hidden="true">filter_alt_off</mat-icon>
        <p class="message" i18n="@@transactions.empty.noMatches">Nothing matches these filters.</p>
        @if (canClear()) {
          <button matButton="tonal" type="button" (click)="cleared.emit()">
            <span i18n="@@transactions.action.clearFilters">Clear filters</span>
          </button>
        }
      }
    </section>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      max-width: 560px;
      margin: 16px auto 0;
      padding: 32px 24px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
      text-align: center;
    }

    .illustration {
      width: 56px;
      height: 56px;
      font-size: 56px;
      color: var(--mat-sys-primary);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    .badge {
      margin-inline-start: 8px;
      padding: 0 6px;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-small);
    }

    .message {
      margin: 0;
      font: var(--mat-sys-body-large);
    }
  `,
})
export class TransactionsEmptyComponent {
  readonly kind = input.required<'none' | 'noMatches'>();
  /** A filter is set, so "Clear filters" can help. */
  readonly canClear = input(false);

  readonly cleared = output<void>();
  readonly addRequested = output<void>();
}
