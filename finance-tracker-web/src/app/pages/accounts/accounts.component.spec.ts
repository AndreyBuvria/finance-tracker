import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { Account, AccountList } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import '@common/locale/locale.utils';
import { HeaderActionsService } from '@infrastructure/layout/header-actions/header-actions.service';
import { Observable, of, Subject, throwError } from 'rxjs';
import { AccountsComponent } from './accounts.component';
import { AccountDialogComponent } from './common/dialogs/account-dialog/account-dialog.component';
import { AccountDialogResult } from './common/dialogs/account-dialog/account-dialog.model';

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function account(overrides: Partial<Account>): Account {
  return {
    id: 'x',
    name: 'x',
    type: AccountTypeEnum.Card,
    currency: 'PLN',
    initialBalance: 0,
    balance: 0,
    isArchived: false,
    ...overrides,
  };
}

const sample: AccountList = {
  items: [
    account({ id: 'cash', name: 'Cash', type: AccountTypeEnum.Cash, balance: 150 }),
    account({ id: 'mbank', name: 'mBank card', balance: 2340.15 }),
    account({ id: 'rev', name: 'Revolut', balance: 412.8 }),
    account({ id: 'sav', name: 'Savings', type: AccountTypeEnum.Savings, balance: 8000 }),
    account({ id: 'old', name: 'Old card', balance: -20, isArchived: true }),
  ],
  netWorth: 10902.95,
};

interface SetupOptions {
  list?: () => Observable<AccountList>;
  dialogResult?: AccountDialogResult;
  archive?: Observable<void>;
  restore?: Observable<void>;
  /** The list request never completes. */
  pending?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const api = {
    list: vi.fn(options.list ?? (() => of(sample))),
    archive: vi.fn(() => options.archive ?? of(undefined)),
    restore: vi.fn(() => options.restore ?? of(undefined)),
  };
  const dialog = {
    openDialogs: [],
    open: vi.fn(() => ({ afterClosed: () => of(options.dialogResult) })),
  };
  const undo$ = new Subject<void>();
  const snackBar = { open: vi.fn(() => ({ onAction: () => undo$ })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AccountsApiService, useValue: api },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(AccountsComponent);
  // A pending list request keeps the app unstable, so only render in that case.
  if (options.pending) {
    fixture.detectChanges();
  } else {
    await fixture.whenStable();
  }
  const el = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  return { fixture, el, api, dialog, snackBar, undo$, stable };
}

async function openMenu(el: HTMLElement, name: string, stable: () => Promise<void>) {
  el.querySelector<HTMLButtonElement>(`[aria-label="More actions for ${name}"]`)!.click();
  await stable();
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'));
}

describe('AccountsComponent', () => {
  it('shows a skeleton while loading', async () => {
    const { el } = await setup({ list: () => new Subject(), pending: true });
    expect(el.querySelector('app-accounts-skeleton')).toBeTruthy();
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Loading accounts…');
    expect(el.querySelector('p.net-worth')).toBeNull();
  });

  it('loads active and archived accounts', async () => {
    const { api } = await setup();
    expect(api.list).toHaveBeenCalledWith(true);
  });

  it('shows net worth and a card per active account with its balance and type', async () => {
    const { el } = await setup();
    expect(visible(el.querySelector('.net-worth')?.textContent)).toBe('Net worth · 10 902,95 zł');
    const cards = Array.from(
      el.querySelectorAll('ul[aria-label="Active accounts"] app-account-card'),
    );
    expect(cards.map((c) => visible(c.querySelector('.name')?.textContent))).toEqual([
      'Cash',
      'mBank card',
      'Revolut',
      'Savings',
    ]);
    expect(visible(cards[1].querySelector('.balance')?.textContent)).toBe('Balance 2 340,15 zł');
    expect(cards.map((c) => c.querySelector('.type-label')?.textContent)).toEqual([
      'Cash',
      'Card',
      'Card',
      'Savings',
    ]);
    expect(cards.map((c) => c.querySelector('.type-icon mat-icon')?.textContent)).toEqual([
      'wallet',
      'credit_card',
      'credit_card',
      'savings',
    ]);
  });

  it('keeps archived accounts in a collapsed section with a badge and Restore', async () => {
    const { el, stable } = await setup();
    const toggle = el.querySelector<HTMLButtonElement>('app-archived-accounts button.toggle')!;
    expect(visible(toggle.textContent)).toContain('Archived accounts (1)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const list = el.querySelector<HTMLElement>('#archived-accounts-list')!;
    expect(list.hidden).toBe(true);

    toggle.click();
    await stable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    const card = list.querySelector('app-account-card')!;
    expect(card.classList).toContain('archived');
    expect(card.querySelector('.badge')?.textContent).toBe('Archived');
    expect(visible(card.querySelector('.balance')?.textContent)).toBe('Balance −20,00 zł');
    expect(card.querySelector('.name')?.getAttribute('aria-level')).toBe('3');
    const restore = card.querySelector('.restore-button');
    expect(visible(restore?.textContent)).toContain('Restore');
    expect(restore?.getAttribute('aria-label')).toBe('Restore Old card');
  });

  it('hides the archived section when there are no archived accounts', async () => {
    const { el } = await setup({
      list: () => of({ items: sample.items.filter((a) => !a.isArchived), netWorth: 1 }),
    });
    expect(el.querySelector('app-archived-accounts button')).toBeNull();
  });

  it('offers "Add account" when there is no active account', async () => {
    const { el, dialog } = await setup({ list: () => of({ items: [], netWorth: 0 }) });
    const add = el.querySelector<HTMLButtonElement>('.add-first')!;
    expect(visible(add.textContent)).toContain('Add account');
    add.click();
    expect(dialog.open).toHaveBeenCalledWith(AccountDialogComponent, expect.anything());
  });

  it('shows a full-page error with the error ID and retries', async () => {
    let calls = 0;
    const { el, api, stable } = await setup({
      list: () =>
        ++calls === 1
          ? throwError(
              () => new HttpErrorResponse({ status: 500, error: { traceId: '7f3a-91c2' } }),
            )
          : of(sample),
    });
    const error = el.querySelector('app-load-error')!;
    expect(error.querySelector('[role="alert"] .message')?.textContent).toBe(
      'Something went wrong. Try again.',
    );
    expect(visible(error.querySelector('.error-id')?.textContent)).toBe('Error ID: 7f3a-91c2');

    error.querySelector<HTMLButtonElement>('button')!.click();
    await stable();
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('app-load-error')).toBeNull();
    expect(el.querySelector('.net-worth')).toBeTruthy();
  });

  it('shows the skeleton, not the old error, while a retry loads', async () => {
    const retry$ = new Subject<AccountList>();
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
    expect(el.querySelector('app-accounts-skeleton')).toBeTruthy();

    retry$.next(sample);
    retry$.complete();
    await fixture.whenStable();
    expect(el.querySelector('app-accounts-skeleton')).toBeNull();
    expect(el.querySelector('.net-worth')).toBeTruthy();
  });

  describe('header action', () => {
    it('registers the primary "Add" (N) that opens "Add account", and clears it on destroy', async () => {
      const { fixture, dialog } = await setup();
      const actions = TestBed.inject(HeaderActionsService);
      const primary = actions.primary()!;
      expect(primary).toMatchObject({
        label: 'Add',
        accessibleLabel: 'Add account',
        icon: 'add',
        shortcut: 'N',
        primary: true,
      });
      primary.handler();
      expect(dialog.open).toHaveBeenCalledWith(
        AccountDialogComponent,
        expect.objectContaining({ data: { account: undefined } }),
      );

      fixture.destroy();
      expect(actions.actions()).toEqual([]);
    });
  });

  describe('add and edit', () => {
    it('confirms an added account and reloads balances', async () => {
      const { api, snackBar, stable } = await setup({
        dialogResult: { status: 'saved', account: sample.items[0] },
      });
      TestBed.inject(HeaderActionsService).primary()!.handler();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith('Account added', undefined, expect.anything());
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('edits an account from its menu', async () => {
      const { el, api, dialog, snackBar, stable } = await setup({
        dialogResult: { status: 'saved', account: sample.items[1] },
      });
      const items = await openMenu(el, 'mBank card', stable);
      expect(items.map((i) => visible(i.textContent))).toEqual(['editEdit', 'archiveArchive']);
      items[0].click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        AccountDialogComponent,
        expect.objectContaining({ data: { account: sample.items[1] } }),
      );
      expect(snackBar.open).toHaveBeenCalledWith('Account updated', undefined, expect.anything());
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('reports and reloads when the edited account no longer exists', async () => {
      const { api, snackBar, stable } = await setup({ dialogResult: { status: 'notFound' } });
      TestBed.inject(HeaderActionsService).primary()!.handler();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        'Something went wrong. Try again.',
        undefined,
        expect.anything(),
      );
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the dialog is closed without saving', async () => {
      const { api, snackBar, stable } = await setup();
      TestBed.inject(HeaderActionsService).primary()!.handler();
      await stable();
      expect(snackBar.open).not.toHaveBeenCalled();
      expect(api.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('archive and restore', () => {
    it('archives with an Undo toast; Undo restores the account', async () => {
      const { el, api, snackBar, undo$, stable } = await setup();
      (await openMenu(el, 'Revolut', stable))[1].click();
      await stable();
      expect(api.archive).toHaveBeenCalledWith('rev');
      expect(snackBar.open).toHaveBeenCalledWith('Account archived', 'Undo', { duration: 5000 });
      expect(api.list).toHaveBeenCalledTimes(2);

      undo$.next();
      await stable();
      expect(api.restore).toHaveBeenCalledWith('rev');
      expect(snackBar.open).toHaveBeenLastCalledWith(
        'Account restored',
        undefined,
        expect.anything(),
      );
    });

    it('explains that the last active account cannot be archived (409)', async () => {
      const { el, api, snackBar, stable } = await setup({
        archive: throwError(() => new HttpErrorResponse({ status: 409 })),
      });
      (await openMenu(el, 'Cash', stable))[1].click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        'You need at least one active account.',
        undefined,
        expect.anything(),
      );
      expect(api.list).toHaveBeenCalledTimes(1);
    });

    it('restores an archived account', async () => {
      const { el, api, snackBar, stable } = await setup();
      el.querySelector<HTMLButtonElement>('.restore-button')!.click();
      await stable();
      expect(api.restore).toHaveBeenCalledWith('old');
      expect(snackBar.open).toHaveBeenCalledWith('Account restored', undefined, expect.anything());
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('asks to rename first when restoring a taken name (409)', async () => {
      const { el, snackBar, stable } = await setup({
        restore: throwError(() => new HttpErrorResponse({ status: 409 })),
      });
      el.querySelector<HTMLButtonElement>('.restore-button')!.click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        'An account with this name already exists. Rename it first.',
        undefined,
        expect.anything(),
      );
    });

    it('offers Edit (rename) but not Archive for an archived account', async () => {
      const { el, stable } = await setup();
      const items = await openMenu(el, 'Old card', stable);
      expect(items.map((i) => visible(i.textContent))).toEqual(['editEdit']);
    });

    it('shows a generic message and reloads after a 404', async () => {
      const { el, api, snackBar, stable } = await setup({
        restore: throwError(() => new HttpErrorResponse({ status: 404 })),
      });
      el.querySelector<HTMLButtonElement>('.restore-button')!.click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        'Something went wrong. Try again.',
        undefined,
        expect.anything(),
      );
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('disables the actions of every card while a change is in flight', async () => {
      const pending = new Subject<void>();
      const { el, fixture } = await setup({ restore: pending });
      el.querySelector<HTMLButtonElement>('.restore-button')!.click();
      fixture.detectChanges();
      const buttons = Array.from(
        el.querySelectorAll<HTMLButtonElement>('app-account-card .menu-button, .restore-button'),
      );
      expect(buttons).toHaveLength(6);
      expect(buttons.every((b) => b.disabled)).toBe(true);

      pending.complete();
      fixture.detectChanges();
      expect(buttons.every((b) => !b.disabled)).toBe(true);
    });

    it('runs an Undo that arrives during another change once that change ends', async () => {
      const restore$ = new Subject<void>();
      let restores = 0;
      const { el, api, fixture, undo$, stable } = await setup();
      api.restore.mockImplementation(() => (++restores === 1 ? restore$ : of(undefined)));

      (await openMenu(el, 'Revolut', stable))[1].click();
      await stable();
      el.querySelector<HTMLButtonElement>('.restore-button')!.click();
      fixture.detectChanges();
      expect(api.restore).toHaveBeenCalledWith('old');

      undo$.next();
      expect(api.restore).toHaveBeenCalledTimes(1);
      restore$.complete();
      expect(api.restore).toHaveBeenCalledTimes(2);
      expect(api.restore).toHaveBeenLastCalledWith('rev');
      expect(fixture.componentInstance.busy()).toBe(false);
    });
  });
});
