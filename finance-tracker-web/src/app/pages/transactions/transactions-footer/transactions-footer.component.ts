import { formatNumber } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MONEY_LOCALE } from '@common/locale/locale.constants';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { TransactionTotals } from '@common/transactions/transaction.model';

/**
 * Sticky footer for the current filter (FEATURES.md F3): "143 transactions · Spent 4 812,30 zł ·
 * Income 7 500,00 zł". The count includes transfers; the API already excludes them from the money
 * and never returns Spent below 0.
 */
@Component({
  selector: 'app-transactions-footer',
  imports: [MoneyPipe],
  template: `
    <p class="summary" aria-live="polite">
      <span i18n="@@transactions.footer.count">{count(), plural,
        =1 {1 transaction}
        other {{{ countText() }} transactions}
      }</span>
      <span aria-hidden="true"> · </span>
      <span i18n="@@transactions.footer.spent">Spent {{ totals().expenses | money }}</span>
      <span aria-hidden="true"> · </span>
      <span i18n="@@transactions.footer.income">Income {{ totals().income | money }}</span>
    </p>
  `,
  styles: `
    :host {
      display: block;
    }

    .summary {
      margin: 0;
      font: var(--mat-sys-title-small);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TransactionsFooterComponent {
  readonly count = input.required<number>();
  readonly totals = input.required<TransactionTotals>();

  /** Polish grouping like the amounts: "1 234". */
  readonly countText = computed(() => formatNumber(this.count(), MONEY_LOCALE, '1.0-0'));
}
