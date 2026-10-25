import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppLocale } from '@common/locale/locale.utils';
import { of } from 'rxjs';
import {
  TransactionFilters,
  TransactionFiltersChange,
} from '../common/models/transaction-filters.model';
import { defaultFilters } from '../utils/transaction-filters.utils';
import { FilterBarComponent } from './filter-bar.component';

@Component({
  imports: [FilterBarComponent],
  template: `<app-filter-bar [filters]="filters()" (filtersChange)="changes.push($event)" />`,
})
class Host {
  readonly filters = signal<TransactionFilters>(defaultFilters(new Date(2026, 9, 1)));
  readonly changes: TransactionFiltersChange[] = [];
}

describe('FilterBarComponent', () => {
  async function setup(desktop = true) {
    TestBed.configureTestingModule({
      providers: [
        provideAppLocale(),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: desktop, breakpoints: {} }),
            isMatched: () => desktop,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = (label: string) =>
      Array.from(el.querySelectorAll('mat-form-field'))
        .find((f) => f.querySelector('mat-label')?.textContent?.trim() === label)!
        .querySelector<HTMLInputElement>('input')!;
    const type = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('input'));
    };
    return { fixture, el, host: fixture.componentInstance, input, type };
  }

  afterEach(() => vi.useRealTimers());

  it('searches after a pause in typing, trimmed', async () => {
    const { host, input, type } = await setup();
    vi.useFakeTimers();
    type(input('Search merchant or note'), ' zab');
    type(input('Search merchant or note'), ' zabka ');
    vi.advanceTimersByTime(299);
    expect(host.changes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.changes).toEqual([{ q: 'zabka' }]);
  });

  it('applies an amount range typed with a comma, and only when valid', async () => {
    const { fixture, el, host, input, type } = await setup();
    vi.useFakeTimers();
    type(input('Min amount'), '50');
    type(input('Max amount'), '10');
    vi.advanceTimersByTime(500);
    expect(host.changes).toEqual([]);
    input('Max amount').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.textContent).toContain("Maximum amount can't be less than minimum amount.");

    type(input('Max amount'), '120,5');
    vi.advanceTimersByTime(500);
    expect(host.changes).toEqual([{ minAmount: 50, maxAmount: 120.5 }]);
  });

  it('rejects a negative amount', async () => {
    const { fixture, el, host, input, type } = await setup();
    vi.useFakeTimers();
    type(input('Min amount'), '-5');
    input('Min amount').dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    expect(host.changes).toEqual([]);
    expect(el.textContent).toContain('Enter an amount of 0 or more.');
  });

  it('moving the month replaces the date range', async () => {
    const { el, host } = await setup();
    el.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.click();
    expect(host.changes).toEqual([{ month: new Date(2026, 8, 1), from: null, to: null }]);
  });

  it('dims the month while a date range replaces it', async () => {
    const { fixture, el, host } = await setup();
    expect(el.querySelector('.month-hint')).toBeNull();
    host.filters.set({
      ...defaultFilters(new Date(2026, 9, 1)),
      from: '2026-10-01',
      to: '2026-10-05',
    });
    await fixture.whenStable();
    expect(el.querySelector('.month-group')?.classList).toContain('inactive');
    expect(el.querySelector('.month-hint')?.textContent?.trim()).toBe(
      'Showing the date range. Pick a month to go back to it.',
    );
    const use = el.querySelector<HTMLButtonElement>('button.use-month')!;
    expect(use.textContent?.trim()).toBe('Show October 2026');
    use.click();
    expect(host.changes).toEqual([{ month: new Date(2026, 9, 1), from: null, to: null }]);
  });

  it('shows the URL state, e.g. after Back, without reporting it', async () => {
    const { fixture, host, input } = await setup();
    host.filters.set({ ...defaultFilters(new Date(2026, 9, 1)), q: 'bolt', minAmount: 12.5 });
    await fixture.whenStable();
    expect(input('Search merchant or note').value).toBe('bolt');
    expect(input('Min amount').value).toBe('12,50');
    expect(host.changes).toEqual([]);
  });

  it('collapses the filters behind "Filters" on mobile', async () => {
    const { fixture, el } = await setup(false);
    const toggle = el.querySelector<HTMLButtonElement>('.filters-toggle')!;
    const panel = el.querySelector<HTMLElement>('#transaction-filters')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
  });
});
