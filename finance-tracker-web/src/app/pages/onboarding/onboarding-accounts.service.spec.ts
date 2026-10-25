import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { Account, AccountRequest } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { OnboardingAccountsService } from './onboarding-accounts.service';

let nextId = 0;
const account = (request: Partial<Account>): Account => ({
  id: `a${++nextId}`,
  name: 'Account',
  type: AccountTypeEnum.Card,
  currency: 'PLN',
  initialBalance: 0,
  balance: request.initialBalance ?? 0,
  isArchived: false,
  ...request,
});

describe('OnboardingAccountsService', () => {
  function setup(existing: Account[] = [], create?: (r: AccountRequest) => Observable<Account>) {
    const api = {
      list: vi.fn(() => of({ items: existing, netWorth: 0 })),
      create: vi.fn(create ?? ((request: AccountRequest) => of(account(request)))),
      update: vi.fn((id: string, request: AccountRequest) => of(account({ ...request, id }))),
      archive: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [OnboardingAccountsService, { provide: AccountsApiService, useValue: api }],
    });
    const service = TestBed.inject(OnboardingAccountsService);
    TestBed.tick();
    const select = (...keys: ('card' | 'savings' | 'cash')[]) =>
      service.form.controls.selected.setValue(keys);
    const save = () => firstValueFrom(service.save(), { defaultValue: undefined });
    return { service, api, select, save };
  }

  it('starts with nothing selected and the suggestion names filled in', () => {
    const { service } = setup();
    expect(service.form.controls.selected.value).toEqual([]);
    expect(service.form.controls.card.getRawValue()).toEqual({
      name: 'Main card',
      initialBalance: '',
    });
    expect(service.form.controls.card.disabled).toBe(true);
  });

  it('creates the selected accounts with trimmed names and 0 for a blank balance', async () => {
    const { service, api, select, save } = setup();
    select('card', 'cash');
    service.form.controls.card.setValue({ name: '  mBank card ', initialBalance: '2 340,15' });
    await save();
    expect(api.create.mock.calls.map(([request]) => request)).toEqual([
      { name: 'mBank card', type: 'Card', currency: 'PLN', initialBalance: 2340.15 },
      { name: 'Cash', type: 'Cash', currency: 'PLN', initialBalance: 0 },
    ]);
  });

  it('never creates duplicates when the step is saved again', async () => {
    const { service, api, select, save } = setup();
    select('card', 'savings');
    await save();
    await save();
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.update).not.toHaveBeenCalled();

    // Back to step 1: rename one, drop the other, add a third.
    service.form.controls.card.controls.name.setValue('mBank card');
    select('card', 'cash');
    await save();
    expect(api.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'mBank card' }),
    );
    expect(api.create).toHaveBeenCalledTimes(3);
    expect(api.archive).toHaveBeenCalledTimes(1);
    // "Main card" stays, so the deselected account is archived first (its name is free then).
    expect(api.archive.mock.invocationCallOrder[0]).toBeLessThan(
      api.update.mock.invocationCallOrder[0],
    );
  });

  it('adopts accounts created before a reload instead of creating them again', async () => {
    const savings = account({
      name: 'Savings',
      type: AccountTypeEnum.Savings,
      initialBalance: 8000,
    });
    const { service, api, save } = setup([savings]);
    expect(service.form.controls.selected.value).toEqual(['savings']);
    expect(service.form.controls.savings.getRawValue()).toEqual({
      name: 'Savings',
      initialBalance: '8000,00',
    });
    await save();
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('puts a duplicate name on its field and continues where it stopped on retry', async () => {
    let calls = 0;
    const { service, api, select, save } = setup([], (request) =>
      ++calls === 2
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { detail: 'An account with this name already exists.' },
              }),
          )
        : of(account(request)),
    );
    select('card', 'savings');
    await expect(save()).rejects.toBeInstanceOf(HttpErrorResponse);
    const name = service.form.controls.savings.controls.name;
    expect(name.hasError('duplicate')).toBe(true);
    expect(name.touched).toBe(true);

    name.setValue('Savings 2');
    await save();
    expect(api.create.mock.calls.map(([request]) => request.name)).toEqual([
      'Main card',
      'Savings',
      'Savings 2',
    ]);
  });

  it('shows API validation messages on their fields', async () => {
    const { service, select, save } = setup([], () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { initialBalance: ['Enter a smaller amount.'] } },
          }),
      ),
    );
    select('cash');
    await expect(save()).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(service.form.controls.cash.controls.initialBalance.getError('server')).toBe(
      'Enter a smaller amount.',
    );
  });

  it('keeps unsaved edits when a resync adopts the accounts again', async () => {
    const savings = account({ name: 'Savings', type: AccountTypeEnum.Savings, initialBalance: 50 });
    const { service } = setup([savings]);
    const fields = service.form.controls.savings.controls;
    fields.name.setValue('Emergency fund');
    fields.name.markAsDirty();
    service.resync();
    TestBed.tick();
    expect(fields.name.value).toBe('Emergency fund');
    expect(fields.initialBalance.value).toBe('50,00');
  });

  it('creates the accounts again after a resync found none', async () => {
    const { service, api, select, save } = setup();
    select('card');
    await save();
    service.resync();
    TestBed.tick();
    await save();
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  describe('reusing the name of a deselected account', () => {
    /** A small in-memory API that enforces unique active names and one active account. */
    function fakeServer() {
      const active = new Map<string, Account>();
      const conflict = (detail: string) =>
        throwError(() => new HttpErrorResponse({ status: 409, error: { detail } }));
      const taken = (name: string, except?: string) =>
        [...active.values()].some(
          (a) => a.id !== except && a.name.toLowerCase() === name.toLowerCase(),
        );
      const api = {
        list: vi.fn(() => of({ items: [...active.values()], netWorth: 0 })),
        create: vi.fn((request: AccountRequest) => {
          if (taken(request.name)) {
            return conflict('An account with this name already exists.');
          }
          const created = account(request);
          active.set(created.id, created);
          return of(created);
        }),
        update: vi.fn((id: string, request: AccountRequest) => {
          if (taken(request.name, id)) {
            return conflict('An account with this name already exists.');
          }
          const updated = account({ ...request, id });
          active.set(id, updated);
          return of(updated);
        }),
        archive: vi.fn((id: string) => {
          if (active.size === 1 && active.has(id)) {
            return conflict('You need at least one active account.');
          }
          active.delete(id);
          return of(undefined);
        }),
      };
      TestBed.configureTestingModule({
        providers: [OnboardingAccountsService, { provide: AccountsApiService, useValue: api }],
      });
      const service = TestBed.inject(OnboardingAccountsService);
      TestBed.tick();
      const select = (...keys: ('card' | 'savings' | 'cash')[]) =>
        service.form.controls.selected.setValue(keys);
      const save = () => firstValueFrom(service.save(), { defaultValue: undefined });
      const names = () => [...active.values()].map((a) => a.name).sort();
      return { service, api, select, save, names };
    }

    it('frees the name first while a created account stays selected', async () => {
      const { service, select, save, names } = fakeServer();
      select('card', 'savings');
      await save();
      // Drop "Savings" and rename "Main card" to "Savings".
      select('card');
      service.form.controls.card.controls.name.setValue('Savings');
      await save();
      expect(names()).toEqual(['Savings']);
    });

    it('lets a new selection take over the account when no created one stays selected', async () => {
      const { service, api, select, save, names } = fakeServer();
      select('card');
      await save();
      // Swap "Main card" for a Savings account named "main card": archiving "Main card" first
      // would remove the last active account.
      select('savings');
      service.form.controls.savings.controls.name.setValue('main card');
      await save();
      expect(names()).toEqual(['main card']);
      expect(api.create).toHaveBeenCalledTimes(1);
      expect(api.archive).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: 'main card', type: 'Savings' }),
      );
      expect(service.form.controls.savings.controls.name.errors).toBeNull();

      // Saving again changes nothing.
      await save();
      expect(api.update).toHaveBeenCalledTimes(1);
    });

    it('reuses a deselected account for its name while another created account stays', async () => {
      const { service, api, select, save, names } = fakeServer();
      select('card', 'savings');
      await save();
      // Keep "Main card", drop "Savings" and call the Cash account "Savings".
      select('card', 'cash');
      service.form.controls.cash.controls.name.setValue('Savings');
      await save();
      expect(names()).toEqual(['Main card', 'Savings']);
      expect(api.create).toHaveBeenCalledTimes(2);
      expect(api.archive).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(api.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: 'Savings', type: 'Cash' }),
      );

      await save();
      expect(api.create).toHaveBeenCalledTimes(2);
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(api.archive).not.toHaveBeenCalled();
    });

    it('renames before creating, so a renamed account frees its name', async () => {
      const { service, api, select, save, names } = fakeServer();
      select('card', 'cash');
      await save();
      // Rename "Cash" to "Wallet" and add a Savings account called "Cash".
      service.form.controls.cash.controls.name.setValue('Wallet');
      select('card', 'savings', 'cash');
      service.form.controls.savings.controls.name.setValue('Cash');
      await save();
      expect(names()).toEqual(['Cash', 'Main card', 'Wallet']);
      expect(api.update.mock.invocationCallOrder[0]).toBeLessThan(
        api.create.mock.invocationCallOrder[2],
      );
      expect(service.form.controls.savings.controls.name.errors).toBeNull();
    });

    it('archives the other deselected accounts after the takeover', async () => {
      const { service, select, save, names } = fakeServer();
      select('card', 'savings');
      await save();
      select('cash');
      service.form.controls.cash.controls.name.setValue('Savings');
      await save();
      expect(names()).toEqual(['Savings']);
    });

    it('passes on a 409 from archiving, without marking a field', async () => {
      const { service, api, select, save } = fakeServer();
      select('card');
      await save();
      api.archive.mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { detail: 'You need at least one active account.' },
            }),
        ),
      );
      select('cash');
      await expect(save()).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.form.valid).toBe(true);

      // The accounts were loaded again: "Main card" is selected again, so a retry doesn't repeat
      // the archive that can't succeed.
      TestBed.tick();
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(service.form.controls.selected.value).toEqual(['card', 'cash']);
      api.archive.mockClear();
      await save();
      expect(api.archive).not.toHaveBeenCalled();
    });
  });
});
