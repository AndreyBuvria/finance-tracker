import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '@common/locale/locale.utils';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import {
  TransactionFilters,
  TransactionFiltersChange,
} from '../common/models/transaction-filters.model';
import { CATEGORIES, IDS } from '../testing/transaction-fixtures.utils';
import { defaultFilters } from '../utils/transaction-filters.utils';
import { FilterChipsComponent } from './filter-chips.component';

@Component({
  imports: [FilterChipsComponent],
  template: `<app-filter-chips
    [filters]="filters()"
    [categories]="categories"
    (removed)="removed.push($event)"
    (cleared)="cleared = cleared + 1"
  />`,
})
class Host {
  readonly filters = signal<TransactionFilters>(defaultFilters(new Date(2026, 9, 1)));
  readonly categories = CATEGORIES;
  readonly removed: TransactionFiltersChange[] = [];
  cleared = 0;
}

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('FilterChipsComponent', () => {
  async function setup(filters: Partial<TransactionFilters>) {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.filters.set({ ...defaultFilters(new Date(2026, 9, 1)), ...filters });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { el, host: fixture.componentInstance };
  }

  it('shows nothing without filters', async () => {
    const { el } = await setup({});
    expect(el.querySelector('mat-chip')).toBeNull();
  });

  it('labels every active filter', async () => {
    const { el } = await setup({
      from: '2026-10-01',
      to: '2026-10-15',
      accountId: IDS.mbank,
      categoryIds: [IDS.groceries, IDS.transport],
      type: TransactionTypeEnum.Expense,
      minAmount: 10,
      maxAmount: 50,
      q: 'zabka',
    });
    const labels = Array.from(el.querySelectorAll('mat-chip')).map((c) =>
      visible(c.textContent).replace(/ cancel$/, ''),
    );
    expect(labels).toEqual([
      '1 Oct 2026 – 15 Oct 2026',
      'Account',
      'Groceries',
      'Transport',
      'Expense',
      '10,00 zł – 50,00 zł',
      '“zabka”',
    ]);
  });

  it('shows open amount ranges', async () => {
    const { el } = await setup({ minAmount: 10 });
    expect(visible(el.querySelector('mat-chip')?.textContent)).toContain('≥ 10,00 zł');
  });

  it('removes one category and clears all', async () => {
    const { el, host } = await setup({ categoryIds: [IDS.groceries, IDS.transport] });
    el.querySelector<HTMLButtonElement>('[aria-label="Remove filter Groceries"]')!.click();
    expect(host.removed).toEqual([{ categoryIds: [IDS.transport] }]);
    el.querySelector<HTMLButtonElement>('button.clear')!.click();
    expect(host.cleared).toBe(1);
  });
});
