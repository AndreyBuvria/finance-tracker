import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, Params, Router } from '@angular/router';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import {
  BulkTransactionResult,
  Transaction,
  TransactionListQuery,
  TransactionPage,
} from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { TransfersApiService } from '@common/transactions/transfers-api.service';
import { QuickAddDialogComponent } from './common/dialogs/quick-add-dialog/quick-add-dialog.component';
import { HeaderActionsService } from '@infrastructure/layout/header-actions/header-actions.service';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { DeleteTransactionsDialogComponent } from './common/dialogs/delete-transactions-dialog/delete-transactions-dialog.component';
import {
  CATEGORIES,
  IDS,
  income,
  page,
  transaction,
  transfer,
} from './testing/transaction-fixtures.utils';
import { TransactionsComponent } from './transactions.component';

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ROWS = [
  transaction({ id: 't1' }),
  transfer({ id: 't2' }),
  income({
    id: 't3',
    date: '2026-10-18',
    source: TransactionSourceEnum.Csv,
    import: { batchId: 'b1', importedAt: '2026-10-18T09:00:00Z' },
  }),
];
const SAMPLE = page(ROWS, { totals: { income: 7500, expenses: 18.47, net: 7481.53 } });

interface SetupOptions {
  params?: Params;
  desktop?: boolean;
  list?: (query: TransactionListQuery) => Observable<TransactionPage>;
  bulk?: () => Observable<BulkTransactionResult>;
  dialogResult?: unknown;
  /** Closes the dialog when this emits (default: right away, with `dialogResult`). */
  afterClosed?: Observable<unknown>;
  /** The list request never completes. */
  pending?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const params$ = new BehaviorSubject(convertToParamMap(options.params ?? {}));
  const router = {
    navigate: vi.fn((_: unknown[], extras: { queryParams: Params }) => {
      params$.next(convertToParamMap(extras.queryParams));
      return Promise.resolve(true);
    }),
  };
  const api = {
    list: vi.fn(options.list ?? (() => of(SAMPLE))),
    bulk: vi.fn(options.bulk ?? (() => of({ affectedCount: 1 }))),
    delete: vi.fn(() => of(undefined)),
  };
  const transfersApi = { delete: vi.fn(() => of(undefined)) };
  /** Quick add reports each added transaction through its `added` output. */
  const added = new Subject<Transaction>();
  const dialog = {
    openDialogs: [],
    open: vi.fn(() => ({
      afterClosed: () => options.afterClosed ?? of(options.dialogResult),
      componentInstance: { added },
    })),
  };
  const undo$ = new Subject<void>();
  const snackBar = { open: vi.fn(() => ({ onAction: () => undo$ })) };
  const scroller = { scrollToPosition: vi.fn() };
  const desktop = options.desktop ?? true;

  TestBed.configureTestingModule({
    providers: [
      provideAppLocale(),
      provideFakeClock('2026-10-19T10:00:00Z'),
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: params$, snapshot: { queryParamMap: params$.value } },
      },
      { provide: Router, useValue: router },
      { provide: TransactionsApiService, useValue: api },
      { provide: TransfersApiService, useValue: transfersApi },
      {
        provide: AccountsApiService,
        useValue: {
          list: () =>
            of({
              items: [
                {
                  id: IDS.mbank,
                  name: 'mBank card',
                  type: AccountTypeEnum.Card,
                  currency: 'PLN',
                  initialBalance: 0,
                  balance: 0,
                  isArchived: false,
                },
              ],
              netWorth: 0,
            }),
        },
      },
      { provide: CategoriesApiService, useValue: { list: () => of({ items: CATEGORIES }) } },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: ViewportScroller, useValue: scroller },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: () => of({ matches: desktop, breakpoints: {} }),
          isMatched: () => desktop,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(TransactionsComponent);
  if (options.pending) {
    fixture.detectChanges();
  } else {
    await fixture.whenStable();
  }
  const el = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  const lastParams = () => router.navigate.mock.lastCall?.[1].queryParams;
  return {
    fixture,
    el,
    api,
    transfersApi,
    router,
    dialog,
    snackBar,
    scroller,
    added,
    undo$,
    stable,
    lastParams,
  };
}

function rowFor(el: HTMLElement, text: string): HTMLElement {
  return Array.from(el.querySelectorAll<HTMLElement>('tr.mat-mdc-row')).find((row) =>
    visible(row.textContent).includes(text),
  )!;
}

function check(container: HTMLElement): void {
  container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
}

describe('TransactionsComponent', () => {
  describe('loading and query', () => {
    it('loads the current Warsaw month, newest first, 50 per page', async () => {
      const { api } = await setup();
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-10-01',
          to: '2026-10-31',
          page: 1,
          pageSize: 50,
          sort: '-date',
        }),
      );
    });

    it('reads the filters from the URL', async () => {
      const { api } = await setup({
        params: { month: '2026-09', category: [IDS.groceries, IDS.transport], q: 'zabka' },
      });
      expect(api.list).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-09-01',
          to: '2026-09-30',
          categoryIds: [IDS.groceries, IDS.transport],
          q: 'zabka',
        }),
      );
    });

    it('writes the current month into the URL so links stay stable', async () => {
      const { router } = await setup();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { month: '2026-10' },
          replaceUrl: true,
        }),
      );
    });

    it('keeps a month that is already in the URL', async () => {
      const { router } = await setup({ params: { month: '2026-09' } });
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('registers the primary "Add" (N) that opens Quick add, and clears it on destroy', async () => {
      const { fixture, dialog } = await setup();
      const actions = TestBed.inject(HeaderActionsService);
      const primary = actions.primary()!;
      expect(primary).toMatchObject({
        label: 'Add',
        accessibleLabel: 'Add transaction',
        icon: 'add',
        shortcut: 'N',
        primary: true,
      });
      primary.handler();
      expect(dialog.open).toHaveBeenCalledWith(
        QuickAddDialogComponent,
        expect.objectContaining({ data: {} }),
      );
      fixture.destroy();
      expect(actions.actions()).toEqual([]);
    });

    it('opens Quick add for ?add=1 and removes the param', async () => {
      const { dialog, router } = await setup({ params: { month: '2026-10', add: '1' } });
      expect(dialog.open).toHaveBeenCalledWith(QuickAddDialogComponent, expect.anything());
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { month: '2026-10' }, replaceUrl: true }),
      );
      expect(dialog.open).toHaveBeenCalledTimes(1);
    });

    it('shows skeleton rows while loading', async () => {
      const { el } = await setup({ list: () => new Subject(), pending: true });
      expect(el.querySelector('app-transactions-skeleton')).toBeTruthy();
      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe(
        'Loading transactions…',
      );
    });

    it('shows a full-page error with the error ID and retries', async () => {
      let calls = 0;
      const { el, api, stable } = await setup({
        list: () =>
          ++calls === 1
            ? throwError(
                () => new HttpErrorResponse({ status: 500, error: { traceId: '7f3a-91c2' } }),
              )
            : of(SAMPLE),
      });
      const error = el.querySelector('app-load-error')!;
      expect(visible(error.querySelector('.error-id')?.textContent)).toBe('Error ID: 7f3a-91c2');
      error.querySelector<HTMLButtonElement>('button')!.click();
      await stable();
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(el.querySelector('app-transactions-table')).toBeTruthy();
    });

    it('shows the skeleton, not the old error, while a retry loads', async () => {
      const retry$ = new Subject<TransactionPage>();
      let calls = 0;
      const { el, fixture } = await setup({
        list: () =>
          ++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : retry$,
      });
      el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
      // Not `whenStable()`: the retry stays pending. The first pass starts it, the second renders.
      fixture.detectChanges();
      fixture.detectChanges();
      expect(el.querySelector('app-load-error')).toBeNull();
      expect(el.querySelector('app-transactions-skeleton')).toBeTruthy();

      retry$.next(SAMPLE);
      retry$.complete();
      await fixture.whenStable();
      expect(el.querySelector('app-transactions-table')).toBeTruthy();
    });
  });

  describe('desktop table', () => {
    it('shows each row with signed amounts, transfers as one neutral row and the source', async () => {
      const { el } = await setup();
      const headers = Array.from(el.querySelectorAll('th')).map((th) => visible(th.textContent));
      expect(headers).toEqual([
        '',
        'Date',
        'Merchant/Note',
        'Category',
        'Account',
        'Amount',
        'Source',
      ]);

      const expense = rowFor(el, 'Żabka');
      expect(visible(expense.textContent)).toContain('19 Oct 2026');
      expect(visible(expense.querySelector('app-transaction-amount')?.textContent)).toBe(
        '−18,47 zł',
      );
      expect(expense.querySelector('app-transaction-amount')?.classList).toContain('expense');
      expect(visible(expense.querySelector('app-source-badge')?.textContent)).toBe('Manual');

      const move = rowFor(el, 'mBank card → Savings');
      expect(visible(move.textContent)).toContain('Transfer');
      expect(move.querySelector('app-category-chip')).toBeNull();
      expect(visible(move.querySelector('app-transaction-amount')?.textContent)).toBe(
        '1 000,00 zł',
      );

      const salary = rowFor(el, '+7 500,00 zł');
      expect(visible(salary.querySelector('app-source-badge')?.textContent)).toBe('Imported');
    });

    it('shows the footer totals for the filter', async () => {
      const { el } = await setup();
      expect(visible(el.querySelector('app-transactions-footer')?.textContent)).toBe(
        '3 transactions · Spent 18,47 zł · Income 7 500,00 zł',
      );
    });

    it('sorts on the server when a column header is clicked', async () => {
      const { el, lastParams, api, stable } = await setup();
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
      const amount = Array.from(el.querySelectorAll<HTMLElement>('th')).find(
        (th) => visible(th.textContent) === 'Amount',
      )!;
      amount.querySelector<HTMLElement>('.mat-sort-header-container')!.click();
      await stable();
      expect(lastParams()).toEqual({ month: '2026-10', sort: '-amount' });
      expect(announce).toHaveBeenCalledWith('Sorted by Amount, descending');
      expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-amount' }));
    });
  });

  describe('archived accounts', () => {
    const OLD = { id: 'old', name: 'Old card', isArchived: true };
    const rows = [
      transaction({ id: 'a1', merchant: 'Lidl', account: OLD }),
      transfer({
        id: 'a2',
        transfer: {
          transferPairId: 'p',
          fromAccount: OLD,
          toAccount: { id: IDS.savings, name: 'Savings', isArchived: false },
        },
      }),
    ];

    it.each([true, false])(
      'shows an "Archived" badge next to the account (desktop: %s)',
      async (desktop) => {
        const { el } = await setup({ desktop, list: () => of(page(rows)) });
        const labels = Array.from(el.querySelectorAll('app-account-label')).map((l) =>
          visible(l.textContent),
        );
        expect(labels).toEqual(['Old card Archived', 'Old card Archived\u2192to Savings']);
        expect(el.querySelectorAll('app-account-label .badge')).toHaveLength(2);
      },
    );
  });

  describe('mobile list', () => {
    it('groups cards by day with the day total in the header', async () => {
      const { el } = await setup({ desktop: false });
      expect(el.querySelector('app-transactions-table')).toBeNull();
      const headers = Array.from(el.querySelectorAll('.day-header')).map((h) =>
        visible(h.textContent),
      );
      expect(headers).toEqual(['Mon, 19 Oct · −18,47 zł', 'Sun, 18 Oct · +7 500,00 zł']);
    });

    it('does not group by day when sorted by something else', async () => {
      const { el } = await setup({ desktop: false, params: { sort: 'amount' } });
      expect(el.querySelector('.day-header')).toBeNull();
      expect(el.querySelectorAll('li.card')).toHaveLength(3);
    });
  });

  describe('filters in the URL', () => {
    it('removes a filter with its chip and goes back to page 1', async () => {
      const { el, lastParams, stable } = await setup({
        params: { type: 'Expense', category: [IDS.groceries], page: '2' },
      });
      const chips = Array.from(el.querySelectorAll('mat-chip')).map((c) => visible(c.textContent));
      expect(chips).toEqual(['Groceries cancel', 'Expense cancel']);
      el.querySelector<HTMLButtonElement>('[aria-label="Remove filter Expense"]')!.click();
      await stable();
      expect(lastParams()).toEqual({ month: '2026-10', category: [IDS.groceries] });
    });

    it('moves to another page', async () => {
      const { el, lastParams, stable } = await setup({
        list: () => of(page(ROWS, { totalCount: 143, totalPages: 3 })),
      });
      expect(visible(el.querySelector('app-pager')?.textContent)).toContain('Page 1 of 3');
      el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
      await stable();
      expect(lastParams()).toEqual({ month: '2026-10', page: '2' });
    });
  });

  describe('empty states', () => {
    const empty = (hasAny: boolean) => (query: TransactionListQuery) =>
      of(query.pageSize === 1 ? page([], { totalCount: hasAny ? 5 : 0 }) : page([]));

    it('says there are no transactions yet when the user has none', async () => {
      const { el } = await setup({ list: empty(false) });
      expect(visible(el.querySelector('app-transactions-empty')?.textContent)).toBe(
        'receipt_long No transactions yet. Add your first one or import a bank statement. ' +
          'addAdd transactionupload_fileImport statementComing soon',
      );
    });

    it('offers "Clear filters" when nothing matches', async () => {
      const { el, lastParams, stable } = await setup({
        list: empty(true),
        params: { type: 'Income', q: 'bolt', month: '2026-09' },
      });
      const state = el.querySelector('app-transactions-empty')!;
      expect(visible(state.querySelector('.message')?.textContent)).toBe(
        'Nothing matches these filters.',
      );
      state.querySelector<HTMLButtonElement>('button')!.click();
      await stable();
      expect(lastParams()).toEqual({ month: '2026-09' });
    });

    it('shows the load error with a retry when the empty-state check fails', async () => {
      let checks = 0;
      const { el, api, stable } = await setup({
        list: (query) =>
          query.pageSize === 1
            ? ++checks === 1
              ? throwError(() => new HttpErrorResponse({ status: 503 }))
              : of(page([], { totalCount: 0 }))
            : of(page([])),
      });
      expect(el.querySelector('app-transactions-skeleton')).toBeNull();
      el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
      await stable();
      expect(api.list).toHaveBeenCalledWith({ pageSize: 1 });
      expect(checks).toBe(2);
      expect(el.querySelector('app-transactions-empty')).toBeTruthy();
    });

    it('shows the skeleton, not the old error, while the empty-state check retries', async () => {
      const retry$ = new Subject<TransactionPage>();
      let checks = 0;
      const { el, fixture } = await setup({
        list: (query) =>
          query.pageSize === 1
            ? ++checks === 1
              ? throwError(() => new HttpErrorResponse({ status: 503 }))
              : retry$
            : of(page([])),
      });
      el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(el.querySelector('app-load-error')).toBeNull();
      expect(el.querySelector('app-transactions-skeleton')).toBeTruthy();

      retry$.next(page([], { totalCount: 0 }));
      retry$.complete();
      await fixture.whenStable();
      expect(el.querySelector('app-transactions-empty')).toBeTruthy();
    });

    it('has nothing to clear when only the month is set', async () => {
      const { el } = await setup({ list: empty(true) });
      expect(el.querySelector('app-transactions-empty button')).toBeNull();
    });
  });

  describe('inline category change', () => {
    async function choose(el: HTMLElement, stable: () => Promise<void>, name: string) {
      el.querySelector<HTMLButtonElement>('[aria-label="Groceries, change category"]')!.click();
      await stable();
      const item = Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(
        (i) => visible(i.textContent).includes(name),
      )!;
      item.click();
      await stable();
    }

    it('saves immediately and confirms with "Saved"', async () => {
      const { el, api, stable } = await setup();
      await choose(el, stable, 'Transport');
      expect(api.bulk).toHaveBeenCalledWith({
        action: 'Recategorize',
        transactionIds: ['t1'],
        categoryId: IDS.transport,
      });
      expect(visible(rowFor(el, 'Żabka').querySelector('.saved')?.textContent)).toBe('checkSaved');
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(
        el.querySelector('[aria-label="Groceries, change category"]'),
      );
    });

    it('keeps the chip focusable while saving, and marks the current category', async () => {
      const pending = new Subject<{ affectedCount: number }>();
      const { el, stable } = await setup({ bulk: () => pending });
      const chip = el.querySelector<HTMLButtonElement>(
        '[aria-label="Groceries, change category"]',
      )!;
      chip.click();
      await stable();
      const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'));
      expect(items[0].getAttribute('aria-current')).toBe('true');
      expect(items[1].hasAttribute('aria-current')).toBe(false);
      items[1].click();
      await stable();
      expect(chip.disabled).toBe(false);
      expect(chip.getAttribute('aria-disabled')).toBe('true');
      pending.next({ affectedCount: 1 });
      pending.complete();
      await stable();
      expect(chip.hasAttribute('aria-disabled')).toBe(false);
    });

    it('offers only active categories that fit the type', async () => {
      const { el, stable } = await setup();
      el.querySelector<HTMLButtonElement>('[aria-label="Groceries, change category"]')!.click();
      await stable();
      const items = Array.from(document.querySelectorAll('[mat-menu-item]')).map((i) =>
        visible(i.textContent),
      );
      expect(items).toEqual([
        'shopping_cartGroceriescheck',
        'directions_busTransport',
        'restaurantEating out',
      ]);
    });

    it('shows the API message when the change fails', async () => {
      const { el, snackBar, stable } = await setup({
        bulk: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 400,
                error: {
                  errors: { categoryId: ['This category is hidden. Choose an active category.'] },
                },
              }),
          ),
      });
      await choose(el, stable, 'Transport');
      expect(snackBar.open).toHaveBeenCalledWith(
        'This category is hidden. Choose an active category.',
        undefined,
        { duration: 5000 },
      );
      expect(el.querySelector('.saved')).toBeNull();
    });
  });

  describe('bulk actions', () => {
    it('shows the selection bar and explains that transfers have no category', async () => {
      const { el, snackBar, api, stable } = await setup();
      check(rowFor(el, 'Żabka'));
      check(rowFor(el, 'mBank card → Savings'));
      await stable();
      const bar = el.querySelector('app-bulk-bar')!;
      expect(visible(bar.querySelector('.count')?.textContent)).toBe('2 selected');

      Array.from(bar.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => visible(b.textContent).includes('Change category'))!
        .click();
      expect(snackBar.open).toHaveBeenCalledWith(
        "Transfers don't have a category. Unselect them first.",
        undefined,
        { duration: 5000 },
      );
      expect(api.bulk).not.toHaveBeenCalled();
    });

    it('recategorizes the selected rows', async () => {
      const { el, api, snackBar, stable } = await setup();
      check(rowFor(el, 'Żabka'));
      await stable();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button'))
        .find((b) => visible(b.textContent).includes('Change category'))!
        .click();
      await stable();
      Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'))
        .find((i) => visible(i.textContent).includes('Eating out'))!
        .click();
      await stable();
      expect(api.bulk).toHaveBeenCalledWith({
        action: 'Recategorize',
        transactionIds: ['t1'],
        categoryId: IDS.eatingOut,
      });
      expect(snackBar.open).toHaveBeenCalledWith('Category changed', undefined, {
        duration: 5000,
      });
      expect(el.querySelector('app-bulk-bar')).toBeNull();
      expect(document.activeElement).toBe(el.querySelector('.results'));
    });

    it('confirms a delete with the count and total, then deletes', async () => {
      const { el, api, dialog, snackBar, stable } = await setup({ dialogResult: true });
      check(rowFor(el, 'Żabka'));
      check(rowFor(el, '+7 500,00 zł'));
      await stable();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button'))
        .find((b) => visible(b.textContent).includes('Delete'))!
        .click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        DeleteTransactionsDialogComponent,
        expect.objectContaining({
          data: {
            count: 2,
            total: { amount: 7481.53, kind: 'income' },
            includesImported: true,
          },
        }),
      );
      expect(api.bulk).toHaveBeenCalledWith({
        action: 'Delete',
        transactionIds: ['t1', 't3'],
      });
      expect(snackBar.open).toHaveBeenCalledWith('Transactions deleted', undefined, {
        duration: 5000,
      });
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('does nothing when the delete is cancelled', async () => {
      const { el, api, stable } = await setup({ dialogResult: false });
      check(rowFor(el, 'Żabka'));
      await stable();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button'))
        .find((b) => visible(b.textContent).includes('Delete'))!
        .click();
      await stable();
      expect(api.bulk).not.toHaveBeenCalled();
    });

    it('reloads and explains when selected rows no longer exist (404)', async () => {
      const { el, api, snackBar, stable } = await setup({
        dialogResult: true,
        bulk: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      });
      check(rowFor(el, 'Żabka'));
      await stable();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button'))
        .find((b) => visible(b.textContent).includes('Delete'))!
        .click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        "One or more of the selected transactions don't exist. Refresh the list and try again.",
        undefined,
        { duration: 5000 },
      );
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('goes to the previous page when the whole last page was deleted', async () => {
      const { el, api, lastParams, scroller, stable } = await setup({
        dialogResult: true,
        params: { month: '2026-10', page: '3' },
        list: () => of(page([transaction()], { page: 3, totalCount: 101, totalPages: 3 })),
      });
      check(el.querySelector<HTMLElement>('th')!);
      await stable();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button'))
        .find((b) => visible(b.textContent).includes('Delete'))!
        .click();
      await stable();
      expect(api.bulk).toHaveBeenCalled();
      expect(lastParams()).toEqual({ month: '2026-10', page: '2' });
      expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
    });

    it('shows the API detail of a 404, e.g. a deleted category', async () => {
      const { el, snackBar, stable } = await setup({
        bulk: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 404,
                error: { status: 404, detail: "This category doesn't exist." },
              }),
          ),
      });
      el.querySelector<HTMLButtonElement>('[aria-label="Groceries, change category"]')!.click();
      await stable();
      Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'))
        .find((i) => visible(i.textContent).includes('Transport'))!
        .click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith("This category doesn't exist.", undefined, {
        duration: 5000,
      });
    });

    it('keeps the bulk buttons focusable while an action runs', async () => {
      const pending = new Subject<{ affectedCount: number }>();
      const { el, api, stable } = await setup({ dialogResult: true, bulk: () => pending });
      check(rowFor(el, 'Żabka'));
      await stable();
      const remove = Array.from(el.querySelectorAll<HTMLButtonElement>('app-bulk-bar button')).find(
        (b) => visible(b.textContent).includes('Delete'),
      )!;
      remove.click();
      await stable();
      expect(remove.disabled).toBe(false);
      expect(remove.getAttribute('aria-disabled')).toBe('true');
      remove.click();
      expect(api.bulk).toHaveBeenCalledTimes(1);
    });

    it('selects every row of the page at once', async () => {
      const { el, stable } = await setup();
      check(el.querySelector<HTMLElement>('th')!);
      await stable();
      expect(visible(el.querySelector('app-bulk-bar .count')?.textContent)).toBe('3 selected');
    });
  });

  describe('quick add and edit', () => {
    it('confirms each added transaction with Undo, which deletes it', async () => {
      const { api, snackBar, added, undo$, stable } = await setup();
      TestBed.inject(HeaderActionsService).primary()!.handler();
      added.next(
        transaction({
          id: 'new',
          amount: 24,
          category: { ...transaction().category!, name: 'Eating out' },
        }),
      );
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        expect.stringMatching(/^Expense added · \u221224,00\s+zł Eating out$/),
        'Undo',
        { duration: 5000 },
      );
      expect(api.list).toHaveBeenCalledTimes(2);

      undo$.next();
      await stable();
      expect(api.delete).toHaveBeenCalledWith('new');
      expect(api.list).toHaveBeenCalledTimes(3);
      expect(snackBar.open).toHaveBeenLastCalledWith('Transaction removed', undefined, {
        duration: 5000,
      });
    });

    it('undoes an added transfer through the transfers endpoint', async () => {
      const { transfersApi, snackBar, added, undo$, stable } = await setup();
      TestBed.inject(HeaderActionsService).primary()!.handler();
      added.next(transfer());
      undo$.next();
      await stable();
      expect(transfersApi.delete).toHaveBeenCalledWith('pair1');
      expect(snackBar.open).toHaveBeenLastCalledWith('Transfer removed', undefined, {
        duration: 5000,
      });
    });

    it('edits a row from a click on it, and confirms the update', async () => {
      const { el, dialog, snackBar, api, stable } = await setup({
        dialogResult: { status: 'updated', transaction: transaction() },
      });
      rowFor(el, 'Żabka').querySelector<HTMLElement>('.date-cell')!.click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        QuickAddDialogComponent,
        expect.objectContaining({ data: { transaction: ROWS[0] } }),
      );
      expect(snackBar.open).toHaveBeenCalledWith('Transaction updated', undefined, {
        duration: 5000,
      });
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('edits from the keyboard through the row title', async () => {
      const { el, dialog } = await setup();
      const title = el.querySelector<HTMLButtonElement>('[aria-label="Edit Żabka, 19 Oct 2026"]')!;
      expect(title.textContent?.trim()).toBe('Żabka');
      title.click();
      expect(dialog.open).toHaveBeenCalledTimes(1);
    });

    it('does not open the edit dialog for clicks on the row controls', async () => {
      const { el, dialog, stable } = await setup();
      check(rowFor(el, 'Żabka'));
      await stable();
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('edits a mobile card', async () => {
      const { el, dialog, snackBar, stable } = await setup({
        desktop: false,
        dialogResult: { status: 'deleted', transaction: transaction() },
      });
      el.querySelector<HTMLElement>('li.card .meta')!.click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        QuickAddDialogComponent,
        expect.objectContaining({ data: { transaction: ROWS[0] } }),
      );
      expect(snackBar.open).toHaveBeenCalledWith('Transaction deleted', undefined, {
        duration: 5000,
      });
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('moves focus to the heading when the edited row was deleted elsewhere', async () => {
      const { el, snackBar, stable } = await setup({ dialogResult: { status: 'notFound' } });
      rowFor(el, 'Żabka').querySelector<HTMLElement>('.date-cell')!.click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith('Something went wrong. Try again.', undefined, {
        duration: 5000,
      });
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('moves focus to the page after adding from the empty state', async () => {
      const closed$ = new Subject<unknown>();
      const { el, added, stable } = await setup({
        afterClosed: closed$,
        list: (query) => of(query.pageSize === 1 ? page([], { totalCount: 0 }) : page([])),
      });
      el.querySelector<HTMLButtonElement>('app-transactions-empty button')!.click();
      added.next(transaction({ id: 'first' }));
      closed$.next(undefined);
      await stable();
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('opens Quick add from the "no transactions" empty state; import is not available yet', async () => {
      const { el, dialog } = await setup({
        list: (query) => of(query.pageSize === 1 ? page([], { totalCount: 0 }) : page([])),
      });
      const buttons = el.querySelectorAll<HTMLButtonElement>('app-transactions-empty button');
      expect(buttons[1].disabled).toBe(true);
      buttons[0].click();
      expect(dialog.open).toHaveBeenCalledWith(QuickAddDialogComponent, expect.anything());
    });
  });
});
