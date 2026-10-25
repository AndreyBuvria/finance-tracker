import { Component } from '@angular/core';

/** Loading state: skeleton rows (DESIGN.md "Transactions": skeleton rows, no spinner). */
@Component({
  selector: 'app-transactions-skeleton',
  template: `
    <div role="status">
      <span class="visually-hidden" i18n="@@transactions.loading">Loading transactions…</span>
    </div>
    <div class="rows" aria-hidden="true">
      @for (row of rows; track row) {
        <div class="row">
          <div class="skeleton-bone box"></div>
          <div class="skeleton-bone date"></div>
          <div class="skeleton-bone merchant"></div>
          <div class="skeleton-bone chip"></div>
          <div class="skeleton-bone amount"></div>
        </div>
      }
    </div>
  `,
  styles: `
    .rows {
      display: grid;
      gap: 8px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 52px;
      padding: 0 16px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
    }

    .box {
      flex: none;
      width: 18px;
      height: 18px;
    }

    .date {
      width: 80px;
      height: 14px;
    }

    .merchant {
      flex: 1;
      height: 16px;
    }

    .chip {
      width: 96px;
      height: 24px;
    }

    .amount {
      width: 72px;
      height: 16px;
    }

    @media (max-width: 599px) {
      .date,
      .chip {
        display: none;
      }
    }
  `,
})
export class TransactionsSkeletonComponent {
  protected readonly rows = [1, 2, 3, 4, 5, 6, 7, 8];
}
