import { formatDate } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { Account } from '@common/accounts/account.model';
import { Category } from '@common/categories/category.model';
import { parseIsoDate } from '@common/date/iso-date.utils';
import { DATE_FORMAT } from '@common/formatting/date-formats.constants';
import { formatMoney } from '@common/formatting/money.utils';
import { TRANSACTION_TYPE_LABELS } from '../common/constants/transaction-type.constants';
import {
  TransactionFilters,
  TransactionFiltersChange,
} from '../common/models/transaction-filters.model';

/** One removable chip and the change that removes it. */
interface FilterChip {
  readonly key: string;
  readonly label: string;
  readonly removeLabel: string;
  readonly removal: TransactionFiltersChange;
}

/**
 * Active filters as removable chips (FEATURES.md F3, DESIGN.md: "Groceries ×", "mBank card ×"),
 * plus "Clear filters". The month is not a chip: the month selector always shows it.
 */
@Component({
  selector: 'app-filter-chips',
  imports: [MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    @if (chips().length > 0) {
      <div class="chips">
        <mat-chip-set aria-label="Active filters" i18n-aria-label="@@transactions.chips.label">
          @for (chip of chips(); track chip.key) {
            <mat-chip (removed)="removed.emit(chip.removal)">
              {{ chip.label }}
              <button matChipRemove type="button" [attr.aria-label]="chip.removeLabel">
                <mat-icon aria-hidden="true">cancel</mat-icon>
              </button>
            </mat-chip>
          }
        </mat-chip-set>
        <button matButton type="button" class="clear" (click)="cleared.emit()">
          <span i18n="@@transactions.action.clearFilters">Clear filters</span>
        </button>
      </div>
    }
  `,
  styles: `
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin-top: 12px;
    }
  `,
})
export class FilterChipsComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly filters = input.required<TransactionFilters>();
  readonly accounts = input<readonly Account[]>([]);
  readonly categories = input<readonly Category[]>([]);

  readonly removed = output<TransactionFiltersChange>();
  readonly cleared = output<void>();

  readonly chips = computed<FilterChip[]>(() => {
    const f = this.filters();
    const chips: Omit<FilterChip, 'removeLabel'>[] = [];

    if (f.from || f.to) {
      chips.push({
        key: 'range',
        label: `${this.date(f.from)} – ${this.date(f.to)}`,
        removal: { from: null, to: null },
      });
    }
    if (f.accountId) {
      const name = this.accounts().find((a) => a.id === f.accountId)?.name;
      chips.push({
        key: 'account',
        label: name ?? $localize`:@@transactions.filter.account:Account`,
        removal: { accountId: null },
      });
    }
    for (const id of f.categoryIds) {
      const name = this.categories().find((c) => c.id === id)?.name;
      chips.push({
        key: `category-${id}`,
        label: name ?? $localize`:@@transactions.filter.category:Category`,
        removal: { categoryIds: f.categoryIds.filter((other) => other !== id) },
      });
    }
    if (f.type) {
      chips.push({ key: 'type', label: TRANSACTION_TYPE_LABELS[f.type], removal: { type: null } });
    }
    if (f.minAmount !== null || f.maxAmount !== null) {
      chips.push({
        key: 'amount',
        label: amountLabel(f.minAmount, f.maxAmount),
        removal: { minAmount: null, maxAmount: null },
      });
    }
    if (f.q) {
      chips.push({ key: 'q', label: `“${f.q}”`, removal: { q: '' } });
    }

    return chips.map((chip) => ({
      ...chip,
      removeLabel: $localize`:@@transactions.chips.remove:Remove filter ${chip.label}:filter:`,
    }));
  });

  /** "19 Oct 2026", or "…" for an open end. */
  private date(iso: string | null): string {
    const date = parseIsoDate(iso);
    return date ? formatDate(date, DATE_FORMAT, this.locale) : '…';
  }
}

/** "10,00 zł – 50,00 zł", "≥ 10,00 zł" or "≤ 50,00 zł". */
function amountLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  return min !== null ? `≥ ${formatMoney(min)}` : `≤ ${formatMoney(max ?? 0)}`;
}
