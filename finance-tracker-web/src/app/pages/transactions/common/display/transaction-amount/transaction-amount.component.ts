import { Component, computed, input } from '@angular/core';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { moneyKind } from '../../../utils/transaction-display.utils';

/**
 * A transaction amount (FEATURES.md §1, DESIGN.md "FORMATTING"): expense "−24,00 zł" in the default
 * text color with a small red accent, income "+7 500,00 zł" in green, transfer neutral without a
 * sign. The sign is the non-color signal.
 */
@Component({
  selector: 'app-transaction-amount',
  imports: [MoneyPipe],
  template: `{{ amount() | money: kind() }}`,
  host: { '[class]': 'kind()' },
  styles: `
    :host {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    :host(.expense)::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-inline-end: 6px;
      border-radius: 50%;
      background: var(--app-color-expense-accent);
      vertical-align: middle;
    }

    :host(.income) {
      color: var(--app-color-income);
    }

    :host(.transfer) {
      color: var(--app-color-transfer);
    }
  `,
})
export class TransactionAmountComponent {
  readonly type = input.required<TransactionTypeEnum>();
  /** Positive; the type gives the sign. */
  readonly amount = input.required<number>();

  readonly kind = computed(() => moneyKind(this.type()));
}
