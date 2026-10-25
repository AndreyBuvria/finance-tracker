import { Component } from '@angular/core';

/** Loading state: net worth line and three card placeholders (no spinner, DESIGN.md). */
@Component({
  selector: 'app-accounts-skeleton',
  template: `
    <div role="status">
      <span class="visually-hidden" i18n="@@accounts.loading">Loading accounts…</span>
    </div>
    <div class="skeleton" aria-hidden="true">
      <div class="skeleton-bone net-worth"></div>
      <div class="account-grid">
        @for (card of cards; track card) {
          <div class="card">
            <div class="row">
              <div class="skeleton-bone circle"></div>
              <div class="skeleton-bone line"></div>
            </div>
            <div class="skeleton-bone amount"></div>
            <div class="skeleton-bone short"></div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['../common/styles/account-grid.scss'],
  styles: `
    .net-worth {
      width: 240px;
      max-width: 70%;
      height: 24px;
      margin-bottom: 24px;
    }

    .card {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .line {
      flex: 1;
      height: 16px;
    }

    .amount {
      width: 60%;
      height: 28px;
    }

    .short {
      width: 30%;
      height: 14px;
    }
  `,
})
export class AccountsSkeletonComponent {
  protected readonly cards = [1, 2, 3];
}
