import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { Account } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { Observable, of, Subject, throwError } from 'rxjs';
import { AccountDialogComponent } from './account-dialog.component';
import { AccountDialogData } from './account-dialog.model';

const saved: Account = {
  id: 'a1',
  name: 'Revolut',
  type: AccountTypeEnum.Savings,
  currency: 'PLN',
  initialBalance: 1234.5,
  balance: 1234.5,
  isArchived: false,
};

async function setup(data: AccountDialogData = {}, response: Observable<Account> = of(saved)) {
  const api = { create: vi.fn(() => response), update: vi.fn(() => response) };
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AccountsApiService, useValue: api },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(AccountDialogComponent);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const component = fixture.componentInstance;

  async function submit() {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }
  const errors = () =>
    Array.from(el.querySelectorAll('mat-error, .field-error, .form-error')).map((e) =>
      e.textContent?.trim(),
    );
  return { fixture, el, component, api, dialogRef, submit, errors };
}

function problem(status: number, body: object = {}) {
  return throwError(() => new HttpErrorResponse({ status, error: { status, ...body } }));
}

describe('AccountDialogComponent', () => {
  describe('add', () => {
    it('shows the fields in spec order with their hints and defaults', async () => {
      const { el, component } = await setup();
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Add account');
      const labels = Array.from(el.querySelectorAll('mat-label, .field-label')).map((l) =>
        l.textContent?.trim(),
      );
      expect(labels).toEqual(['Name', 'Type', 'Currency', 'Starting balance']);
      expect(component.form.controls.type.value).toBe(AccountTypeEnum.Card);
      const currency = el.querySelectorAll<HTMLInputElement>('input')[1];
      expect(currency.disabled).toBe(true);
      expect(currency.value).toBe('PLN');
      const hints = Array.from(el.querySelectorAll('mat-hint')).map((h) => h.textContent?.trim());
      expect(hints).toEqual([
        'More currencies coming soon',
        'The balance on the day you start tracking. Check your bank app.',
      ]);
      const toggles = Array.from(el.querySelectorAll('mat-button-toggle')).map((t) =>
        t.textContent?.replace(/credit_card|savings|wallet/, '').trim(),
      );
      expect(toggles).toEqual(['Card', 'Savings', 'Cash']);
      expect(el.querySelector('mat-button-toggle-group')?.getAttribute('aria-labelledby')).toBe(
        'account-type-label',
      );
    });

    it('requires a name and does not call the API', async () => {
      const { api, submit, errors, el } = await setup();
      await submit();
      expect(errors()).toEqual(['Enter an account name.']);
      expect(api.create).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(el.querySelector('input'));
    });

    it('limits the trimmed name to 50 characters', async () => {
      const { component, submit, errors } = await setup();
      component.form.controls.name.setValue(` ${'a'.repeat(50)} `);
      await submit();
      expect(errors()).toEqual([]);
      component.form.controls.name.setValue('a'.repeat(51));
      await submit();
      expect(errors()).toEqual(['Name can be at most 50 characters.']);
    });

    it.each([
      ['abc', 'Enter a valid amount.'],
      ['1,234', 'Enter an amount with at most 2 decimal places.'],
      ['10000000000000', 'Enter a smaller amount.'],
    ])('rejects the starting balance "%s"', async (value, message) => {
      const { component, api, submit, errors } = await setup();
      component.form.controls.name.setValue('Cash');
      component.form.controls.initialBalance.setValue(value);
      await submit();
      expect(errors()).toEqual([message]);
      expect(api.create).not.toHaveBeenCalled();
    });

    it('creates the account with a trimmed name and parsed balance, then closes with it', async () => {
      const { el, fixture, component, api, dialogRef, submit } = await setup();
      const name = el.querySelector<HTMLInputElement>('input')!;
      name.value = '  Revolut ';
      name.dispatchEvent(new Event('input'));
      component.form.controls.type.setValue(AccountTypeEnum.Savings);
      component.form.controls.initialBalance.setValue('1 234,5');
      await fixture.whenStable();
      await submit();
      expect(api.create).toHaveBeenCalledWith({
        name: 'Revolut',
        type: AccountTypeEnum.Savings,
        currency: 'PLN',
        initialBalance: 1234.5,
      });
      expect(dialogRef.close).toHaveBeenCalledWith({ status: 'saved', account: saved });
    });

    it('sends a blank starting balance as 0 and accepts a negative one', async () => {
      const { component, api, submit } = await setup();
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(api.create).toHaveBeenLastCalledWith(expect.objectContaining({ initialBalance: 0 }));
      component.form.controls.initialBalance.setValue('-50,25');
      await submit();
      expect(api.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ initialBalance: -50.25 }),
      );
    });

    it('shows "Saving…" and ignores a second submit while saving', async () => {
      const pending = new Subject<Account>();
      const { component, api, submit, el } = await setup({}, pending);
      component.form.controls.name.setValue('Cash');
      await submit();
      await submit();
      expect(api.create).toHaveBeenCalledTimes(1);
      expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Saving…');
    });

    it('shows the duplicate-name message on the name field (409) and focuses it', async () => {
      const { component, dialogRef, submit, errors, el } = await setup(
        {},
        problem(409, { detail: 'An account with this name already exists.' }),
      );
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(errors()).toEqual(['An account with this name already exists.']);
      expect(document.activeElement).toBe(el.querySelector('input[formcontrolname="name"]'));
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('shows API validation messages on their fields (400) and focuses the first', async () => {
      const { component, submit, errors, el } = await setup(
        {},
        problem(400, {
          errors: { Name: ['Enter an account name.'], initialBalance: ['Enter a smaller amount.'] },
        }),
      );
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(errors()).toEqual(['Enter an account name.', 'Enter a smaller amount.']);
      expect(document.activeElement).toBe(el.querySelector('input[formcontrolname="name"]'));
    });

    it('shows a currency message from the API above the form', async () => {
      const { component, submit, errors } = await setup(
        {},
        problem(400, { errors: { currency: ['Only PLN is supported for now.'] } }),
      );
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(errors()).toEqual(['Only PLN is supported for now.']);
    });

    it('focuses the starting balance when only it is rejected by the API', async () => {
      const { component, submit, el } = await setup(
        {},
        problem(400, { errors: { initialBalance: ['Enter a smaller amount.'] } }),
      );
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(document.activeElement).toBe(
        el.querySelector('input[formcontrolname="initialBalance"]'),
      );
    });

    it('shows a generic error for a 404 while adding', async () => {
      const { component, submit, errors, dialogRef } = await setup({}, problem(404));
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(errors()).toEqual(['Something went wrong. Try again.']);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('shows a generic error for anything else', async () => {
      const { component, submit, errors, el } = await setup({}, problem(500));
      component.form.controls.name.setValue('Cash');
      await submit();
      expect(errors()).toEqual(['Something went wrong. Try again.']);
      expect(el.querySelector('.form-error')?.getAttribute('role')).toBe('alert');
    });
  });

  describe('edit', () => {
    const account: Account = { ...saved, name: 'Savings', initialBalance: -12.3, isArchived: true };

    it('is pre-filled and titled "Edit account"', async () => {
      const { el, component } = await setup({ account });
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Edit account');
      expect(component.form.getRawValue()).toEqual({
        name: 'Savings',
        type: AccountTypeEnum.Savings,
        currency: 'PLN',
        initialBalance: '-12,30',
      });
    });

    it('replaces the account with all current values', async () => {
      const { component, api, dialogRef, submit } = await setup({ account });
      component.form.controls.name.setValue('Old savings');
      await submit();
      expect(api.update).toHaveBeenCalledWith('a1', {
        name: 'Old savings',
        type: AccountTypeEnum.Savings,
        currency: 'PLN',
        initialBalance: -12.3,
      });
      expect(api.create).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith({ status: 'saved', account: saved });
    });

    it('closes with notFound when the account no longer exists (404)', async () => {
      const { api, dialogRef, submit } = await setup({ account }, problem(404));
      await submit();
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(dialogRef.close).toHaveBeenCalledWith({ status: 'notFound' });
    });
  });
});
