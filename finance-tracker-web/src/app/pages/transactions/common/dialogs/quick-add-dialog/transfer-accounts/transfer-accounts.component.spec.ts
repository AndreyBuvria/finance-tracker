import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TransactionAccount } from '@common/transactions/transaction.model';
import { differentAccountsValidator } from '../../../../utils/quick-add-form.utils';
import { TransferAccountsComponent } from './transfer-accounts.component';

@Component({
  imports: [TransferAccountsComponent],
  template: `<app-transfer-accounts [from]="from" [to]="to" [accounts]="accounts" />`,
})
class Host {
  // As in the Quick add form: "To" is checked against its sibling "From".
  readonly group = new FormGroup({
    fromAccountId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    toAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, differentAccountsValidator],
    }),
  });
  readonly from = this.group.controls.fromAccountId;
  readonly to = this.group.controls.toAccountId;
  readonly accounts: TransactionAccount[] = [
    { id: 'a1', name: 'mBank card', isArchived: false },
    { id: 'a2', name: 'Savings', isArchived: false },
  ];
}

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('TransferAccountsComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const errors = () => Array.from(el.querySelectorAll('mat-error')).map((e) => text(e));
    return { fixture, el, host, errors };
  }

  it('labels both account fields', async () => {
    const { el } = await setup();
    expect(Array.from(el.querySelectorAll('mat-label')).map((l) => text(l))).toEqual([
      'From account',
      'To account',
    ]);
    expect(el.querySelectorAll('mat-select')).toHaveLength(2);
  });

  it('asks for both accounts once touched', async () => {
    const { fixture, host, errors } = await setup();
    host.from.markAsTouched();
    host.to.markAsTouched();
    await fixture.whenStable();
    expect(errors()).toEqual([
      'Choose the account to move money from.',
      'Choose the account to move money to.',
    ]);
  });

  it('shows API messages on their field', async () => {
    const { fixture, host, errors } = await setup();
    host.from.setValue('a1');
    host.to.setValue('a2');
    host.to.setErrors({ server: 'This account is archived. Choose an active account.' });
    host.to.markAsTouched();
    await fixture.whenStable();
    expect(errors()).toEqual(['This account is archived. Choose an active account.']);
  });

  it('asks for two different accounts', async () => {
    const { fixture, host, errors } = await setup();
    host.from.setValue('a1');
    host.to.setValue('a1');
    host.to.markAsTouched();
    await fixture.whenStable();
    expect(errors()).toEqual(['Choose two different accounts.']);
  });

  it('offers the given accounts in both fields', async () => {
    const { el, fixture } = await setup();
    el.querySelectorAll<HTMLElement>('mat-select')[1].click();
    await fixture.whenStable();
    const options = Array.from(document.querySelectorAll('mat-option')).map((o) => text(o));
    expect(options).toEqual(['mBank card', 'Savings']);
  });
});
