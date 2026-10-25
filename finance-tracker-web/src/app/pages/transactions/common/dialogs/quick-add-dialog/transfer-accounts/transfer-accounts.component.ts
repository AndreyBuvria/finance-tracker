import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TransactionAccount } from '@common/transactions/transaction.model';
import { controlState } from '../../../../utils/control-state.utils';

/** "From account" and "To account" of a transfer (FEATURES.md F4), with the contract messages. */
@Component({
  selector: 'app-transfer-accounts',
  imports: [MatFormFieldModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.quickAdd.fromAccount">From account</mat-label>
      <mat-select [formControl]="from()">
        @for (account of accounts(); track account.id) {
          <mat-option [value]="account.id">{{ account.name }}</mat-option>
        }
      </mat-select>
      @let fromErrors = fromState().errors;
      @if (fromErrors?.['required']) {
        <mat-error i18n="@@transactions.quickAdd.fromAccount.required"
          >Choose the account to move money from.</mat-error
        >
      } @else if (fromErrors?.['server']; as message) {
        <mat-error>{{ message }}</mat-error>
      }
    </mat-form-field>
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.quickAdd.toAccount">To account</mat-label>
      <mat-select [formControl]="to()">
        @for (account of accounts(); track account.id) {
          <mat-option [value]="account.id">{{ account.name }}</mat-option>
        }
      </mat-select>
      @let toErrors = toState().errors;
      @if (toErrors?.['required']) {
        <mat-error i18n="@@transactions.quickAdd.toAccount.required"
          >Choose the account to move money to.</mat-error
        >
      } @else if (toErrors?.['sameAccounts']) {
        <mat-error i18n="@@transactions.quickAdd.toAccount.same"
          >Choose two different accounts.</mat-error
        >
      } @else if (toErrors?.['server']; as message) {
        <mat-error>{{ message }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class TransferAccountsComponent {
  readonly from = input.required<FormControl<string>>();
  readonly to = input.required<FormControl<string>>();
  /** Active accounts, plus archived ones an edited transfer already uses. */
  readonly accounts = input.required<readonly TransactionAccount[]>();

  protected readonly fromState = controlState(this.from, '');
  protected readonly toState = controlState(this.to, '');
}
