import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { UserStorageService } from '@common/auth/user-storage.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { provideAppLocale } from '@common/locale/locale.utils';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { Transaction } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { TransfersApiService } from '@common/transactions/transfers-api.service';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  CATEGORIES,
  IDS,
  income,
  transaction,
  transfer,
} from '../../../testing/transaction-fixtures.utils';
import { DeleteTransactionsDialogComponent } from '../delete-transactions-dialog/delete-transactions-dialog.component';
import { QuickAddDialogComponent } from './quick-add-dialog.component';
import { QuickAddDialogData } from './quick-add-dialog.model';

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const account = (id: string, name: string) => ({
  id,
  name,
  type: AccountTypeEnum.Card,
  currency: 'PLN' as const,
  initialBalance: 0,
  balance: 0,
  isArchived: false,
});

/** Per-user device preferences (see `UserStorageService`). */
let preferences: Record<string, string>;

interface SetupOptions {
  data?: QuickAddDialogData;
  create?: () => Observable<Transaction>;
  accounts?: () => Observable<unknown>;
  confirmDelete?: boolean;
}

function setupSync(options: SetupOptions = {}) {
  const transactionsApi = {
    create: vi.fn(options.create ?? (() => of(transaction({ id: 'new' })))),
    update: vi.fn(() => of(transaction())),
    delete: vi.fn(() => of(undefined)),
    merchants: vi.fn(() => of({ items: [] })),
  };
  const transfersApi = {
    create: vi.fn(() => of(transfer({ id: 'new-transfer' }))),
    update: vi.fn(() => of(transfer())),
    delete: vi.fn(() => of(undefined)),
  };
  const categoriesApi = {
    top: vi.fn(({ type }: { type: CategoryTypeEnum }) =>
      of({ items: CATEGORIES.filter((c) => !c.isArchived && c.type === type) }),
    ),
    list: vi.fn(() => of({ items: CATEGORIES.filter((c) => !c.isArchived) })),
  };
  const dialogRef = { close: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(options.confirmDelete) })) };

  TestBed.configureTestingModule({
    providers: [
      provideAppLocale(),
      provideFakeClock('2026-10-19T10:00:00Z'),
      { provide: MAT_DIALOG_DATA, useValue: options.data ?? {} },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MatDialog, useValue: dialog },
      { provide: TransactionsApiService, useValue: transactionsApi },
      { provide: TransfersApiService, useValue: transfersApi },
      { provide: CategoriesApiService, useValue: categoriesApi },
      {
        provide: AccountsApiService,
        useValue: {
          list: vi.fn(
            options.accounts ??
              (() =>
                of({
                  items: [account(IDS.mbank, 'mBank card'), account(IDS.savings, 'Savings')],
                  netWorth: 0,
                })),
          ),
        },
      },
      {
        provide: UserStorageService,
        useValue: {
          get: (name: string) => preferences[name] ?? null,
          set: (name: string, value: string) => (preferences[name] = value),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(QuickAddDialogComponent);
  const component = fixture.componentInstance;
  const added: Transaction[] = [];
  component.added.subscribe((t) => added.push(t));
  const el = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  const amount = () => el.querySelector<HTMLInputElement>('input.amount-input')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const tile = (name: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('app-category-grid .tile')).find((b) =>
      visible(b.textContent).endsWith(name),
    )!;
  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')).find(
      (b) => visible(b.textContent) === text,
    )!;
  const errors = () =>
    Array.from(el.querySelectorAll('mat-error, .error')).map((e) => visible(e.textContent));
  return {
    fixture,
    component,
    el,
    stable,
    amount,
    type,
    tile,
    button,
    errors,
    added,
    dialogRef,
    dialog,
    transactionsApi,
    transfersApi,
    categoriesApi,
  };
}

async function setup(options: SetupOptions = {}) {
  const result = setupSync(options);
  await result.fixture.whenStable();
  return result;
}

/** Renders while a list request is still pending (the fixture would never become stable). */
async function setupPending(accounts: () => Observable<unknown>) {
  const result = setupSync({ accounts });
  // The first pass starts the requests; the second renders their loading state.
  result.fixture.detectChanges();
  result.fixture.detectChanges();
  return result;
}

describe('QuickAddDialogComponent', () => {
  beforeEach(() => (preferences = {}));

  describe('quick add', () => {
    it('starts as an expense for today with the amount focused', async () => {
      const { el, amount, component } = await setup();
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Add transaction');
      expect(document.activeElement).toBe(amount());
      expect(amount().placeholder).toBe('0,00');
      expect(amount().getAttribute('inputmode')).toBe('decimal');
      expect(component.form.controls.type.value).toBe('Expense');
      expect(component.form.controls.date.value).toEqual(new Date(2026, 9, 19));
      expect(el.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim()).toBe(
        'Today',
      );
      expect(el.querySelector('textarea')).toBeNull();
    });

    it('shows the top categories of the type as tiles, plus "More"', async () => {
      const { el, categoriesApi } = await setup();
      expect(categoriesApi.top).toHaveBeenCalledWith({ limit: 8, type: 'Expense' });
      const tiles = Array.from(el.querySelectorAll('app-category-grid .tiles')[0].children).map(
        (t) => visible(t.textContent),
      );
      expect(tiles).toEqual([
        'shopping_cartGroceries',
        'directions_busTransport',
        'restaurantEating out',
        'more_horizMore',
      ]);
    });

    it('defaults to the last account used, else the first active one', async () => {
      const first = await setup();
      expect(first.component.form.controls.accountId.value).toBe(IDS.mbank);
      TestBed.resetTestingModule();
      preferences = { lastAccountId: IDS.savings };
      const second = await setup();
      expect(second.component.form.controls.accountId.value).toBe(IDS.savings);
    });

    it('explains what is missing and focuses the first invalid field', async () => {
      const { button, errors, stable, amount, transactionsApi } = await setup();
      amount().blur();
      button('Save and add another').click();
      await stable();
      expect(errors()).toEqual(['Enter an amount greater than 0.', 'Choose a category.']);
      expect(document.activeElement).toBe(amount());
      expect(transactionsApi.create).not.toHaveBeenCalled();
    });

    it('saves an expense in three steps (amount, category, save) and closes', async () => {
      const { amount, type, tile, button, stable, transactionsApi, dialogRef, added } =
        await setup();
      type(amount(), '12.50');
      tile('Eating out').click();
      button('Save').click();
      await stable();
      expect(transactionsApi.create).toHaveBeenCalledWith({
        type: 'Expense',
        amount: 12.5,
        date: '2026-10-19',
        accountId: IDS.mbank,
        categoryId: IDS.eatingOut,
        merchant: null,
        note: null,
      });
      expect(added.map((t) => t.id)).toEqual(['new']);
      expect(dialogRef.close).toHaveBeenCalledWith();
      expect(preferences).toEqual({ lastAccountId: IDS.mbank });
    });

    it('accepts a comma and keeps date and account for "Save and add another"', async () => {
      const { component, amount, type, tile, button, el, stable, dialogRef, added } = await setup();
      el.querySelectorAll<HTMLElement>('mat-chip-option [role="option"]')[1].click();
      component.form.controls.accountId.setValue(IDS.savings);
      type(amount(), '24,00');
      type(el.querySelector<HTMLInputElement>('app-merchant-field input')!, 'Bolt');
      tile('Transport').click();
      button('Save and add another').click();
      await stable();
      expect(added).toHaveLength(1);
      expect(dialogRef.close).not.toHaveBeenCalled();
      const value = component.form.getRawValue();
      expect(value.amount).toBe('');
      expect(value.merchant).toBe('');
      expect(value.date).toEqual(new Date(2026, 9, 18));
      expect(value.accountId).toBe(IDS.savings);
      expect(value.type).toBe('Expense');
      expect(value.categoryId).toBe('');
      expect(document.activeElement).toBe(amount());
    });

    it('does not send a note typed for a transfer after switching back to an expense', async () => {
      const { component, amount, type, tile, button, stable, transactionsApi } = await setup();
      component.form.controls.type.setValue(TransactionTypeEnum.Transfer);
      component.form.controls.note.setValue('Holiday');
      component.form.controls.type.setValue(TransactionTypeEnum.Expense);
      await stable();
      type(amount(), '5');
      tile('Groceries').click();
      button('Save').click();
      await stable();
      expect(transactionsApi.create).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
    });

    it('shows a light loading state and keeps Save disabled until the lists are loaded', async () => {
      const accounts$ = new Subject<unknown>();
      const { el, button, component } = await setupPending(() => accounts$);
      expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Loading…');
      expect(el.querySelector('app-category-grid')).toBeNull();
      expect(button('Save').getAttribute('aria-disabled')).toBe('true');
      component.submit();
      expect(component.submitting()).toBe(false);
    });

    it('offers to try again when the accounts or categories cannot be loaded', async () => {
      let calls = 0;
      const { el, button, stable } = await setup({
        accounts: () =>
          ++calls === 1
            ? throwError(() => new HttpErrorResponse({ status: 500 }))
            : of({ items: [account(IDS.mbank, 'mBank card')], netWorth: 0 }),
      });
      const error = el.querySelector('.load-error[role="alert"]')!;
      expect(visible(error.textContent)).toBe('Something went wrong. Try again.Try again');
      expect(button('Save').getAttribute('aria-disabled')).toBe('true');
      error.querySelector<HTMLButtonElement>('button')!.click();
      await stable();
      expect(el.querySelector('.load-error')).toBeNull();
      expect(button('Save').hasAttribute('aria-disabled')).toBe(false);
    });

    it("pre-selects a past merchant's last category unless one was picked", async () => {
      const { component, tile } = await setup();
      const suggestion = {
        merchant: 'Bolt',
        lastUsedOn: '2026-10-18',
        lastCategory: { ...transaction().category!, id: IDS.transport, name: 'Transport' },
      };
      component.useMerchant(suggestion);
      expect(component.form.controls.categoryId.value).toBe(IDS.transport);

      tile('Groceries').click();
      component.useMerchant(suggestion);
      expect(component.form.controls.categoryId.value).toBe(IDS.groceries);
    });

    it('offers expense categories to income under "More" (refunds)', async () => {
      const { component, el, stable } = await setup();
      component.form.controls.type.setValue(TransactionTypeEnum.Income);
      await stable();
      const more = el.querySelector<HTMLButtonElement>('app-category-grid .more')!;
      more.click();
      await stable();
      expect(more.getAttribute('aria-expanded')).toBe('true');
      const groups = Array.from(el.querySelectorAll('app-category-grid .all > [role="group"]')).map(
        (g) => g.getAttribute('aria-label'),
      );
      expect(groups).toEqual(['Income', 'Expense']);
    });

    it('keeps the form and tiles on a type switch; the skeleton is for the first load only', async () => {
      const { component, el, fixture, categoriesApi, stable } = await setup();
      const income$ = new Subject<{ items: typeof CATEGORIES }>();
      categoriesApi.top.mockImplementation(({ type }: { type: CategoryTypeEnum }) =>
        type === CategoryTypeEnum.Income
          ? income$
          : of({ items: CATEGORIES.filter((c) => !c.isArchived && c.type === type) }),
      );
      const status = el.querySelector('[role="status"]')!;
      const tiles = () =>
        Array.from(el.querySelectorAll('app-category-grid .tiles')[0].children).map((t) =>
          visible(t.textContent),
        );

      component.form.controls.type.setValue(TransactionTypeEnum.Income);
      // Not `whenStable()`: the income tiles are still loading.
      fixture.detectChanges();
      fixture.detectChanges();
      expect(el.querySelector('app-quick-add-load-state .loading')).toBeNull();
      expect(el.querySelector('[role="status"]')).toBe(status);
      expect(status.textContent?.trim()).toBe('');
      // Meanwhile the income categories from the full list stand in.
      expect(tiles()).toEqual(['paymentsSalary', 'savingsOther income', 'more_horizMore']);

      income$.next({ items: CATEGORIES.filter((c) => c.name === 'Other income') });
      income$.complete();
      await stable();
      expect(tiles()).toEqual(['savingsOther income', 'more_horizMore']);
    });

    it('rejects dates after tomorrow', async () => {
      const { component, stable, errors } = await setup();
      component.form.controls.date.setValue(new Date(2026, 9, 21));
      component.form.controls.date.markAsTouched();
      await stable();
      expect(errors()).toContain("Date can't be in the future.");
      component.form.controls.date.setValue(new Date(2026, 9, 20));
      expect(component.form.controls.date.valid).toBe(true);
    });

    it('shows API validation messages on their fields', async () => {
      const { amount, type, tile, button, stable, errors } = await setup({
        create: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 400,
                error: { errors: { amount: ['Enter a smaller amount.'] } },
              }),
          ),
      });
      type(amount(), '5');
      tile('Groceries').click();
      button('Save').click();
      await stable();
      expect(errors()).toEqual(['Enter a smaller amount.']);
      expect(document.activeElement).toBe(amount());
    });
  });

  describe('transfer', () => {
    it('asks for two different accounts and saves through /transfers', async () => {
      const { component, el, amount, type, button, stable, errors, transfersApi } = await setup();
      component.form.controls.type.setValue(TransactionTypeEnum.Transfer);
      await stable();
      expect(el.querySelector('app-category-grid')).toBeNull();
      expect(el.querySelector('textarea')).toBeTruthy();
      type(amount(), '1000');
      component.form.controls.toAccountId.setValue(IDS.mbank);
      button('Save').click();
      await stable();
      expect(errors()).toEqual(['Choose two different accounts.']);

      component.form.controls.toAccountId.setValue(IDS.savings);
      button('Save').click();
      await stable();
      expect(transfersApi.create).toHaveBeenCalledWith({
        fromAccountId: IDS.mbank,
        toAccountId: IDS.savings,
        amount: 1000,
        date: '2026-10-19',
        note: null,
      });
    });
  });

  describe('edit', () => {
    it('pre-fills the row, shows the note and replaces it in full', async () => {
      const row = transaction({ note: 'Snacks' });
      const { el, component, button, stable, transactionsApi, dialogRef } = await setup({
        data: { transaction: row },
      });
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Edit transaction');
      expect(component.form.getRawValue()).toMatchObject({
        type: 'Expense',
        amount: '18,47',
        categoryId: IDS.groceries,
        merchant: 'Żabka',
        note: 'Snacks',
        accountId: IDS.mbank,
      });
      expect(el.querySelector('.add-another')).toBeNull();
      button('Save').click();
      await stable();
      expect(transactionsApi.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ note: 'Snacks', merchant: 'Żabka' }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith({
        status: 'updated',
        transaction: expect.anything(),
      });
    });

    it('keeps an unchanged archived account and hidden category', async () => {
      const row = income({
        account: { id: 'old', name: 'Old card', isArchived: true },
        category: { ...income().category!, id: 'hidden', name: 'Bonus', isArchived: true },
      });
      const { component, el } = await setup({ data: { transaction: row } });
      expect(component.lists.accountOptions().map((a) => a.name)).toEqual([
        'mBank card',
        'Savings',
        'Old card',
      ]);
      expect(visible(el.querySelector('app-category-grid .tile.selected')?.textContent)).toBe(
        'paymentsBonus',
      );
    });

    it('edits a transfer through /transfers/{pairId}, without switching type', async () => {
      const { el, button, stable, transfersApi } = await setup({
        data: { transaction: transfer() },
      });
      const toggles = Array.from(el.querySelectorAll('mat-button-toggle button'));
      expect(toggles.map((t) => t.hasAttribute('disabled'))).toEqual([true, true, false]);
      button('Save').click();
      await stable();
      expect(transfersApi.update).toHaveBeenCalledWith('pair1', expect.anything());
    });

    it('deletes after confirmation, warning about re-imports', async () => {
      const row = transaction({ source: TransactionSourceEnum.Csv });
      const { button, stable, dialog, transactionsApi, dialogRef } = await setup({
        data: { transaction: row },
        confirmDelete: true,
      });
      button('Delete').click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        DeleteTransactionsDialogComponent,
        expect.objectContaining({
          data: { count: 1, total: { amount: 18.47, kind: 'expense' }, includesImported: true },
        }),
      );
      expect(transactionsApi.delete).toHaveBeenCalledWith('t1');
      expect(dialogRef.close).toHaveBeenCalledWith({ status: 'deleted', transaction: row });
    });

    it('focuses the note when the API rejects it', async () => {
      const { el, button, stable, transactionsApi, errors } = await setup({
        data: { transaction: transaction({ note: 'x' }) },
      });
      transactionsApi.update.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: { note: ['Note can be at most 500 characters.'] } },
            }),
        ),
      );
      button('Save').click();
      await stable();
      expect(errors()).toEqual(['Note can be at most 500 characters.']);
      expect(document.activeElement).toBe(el.querySelector('textarea'));
    });

    it('reports a transaction deleted elsewhere', async () => {
      const { button, stable, transactionsApi, dialogRef } = await setup({
        data: { transaction: transaction() },
      });
      transactionsApi.update.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 })),
      );
      button('Save').click();
      await stable();
      expect(dialogRef.close).toHaveBeenCalledWith({ status: 'notFound' });
    });
  });
});
