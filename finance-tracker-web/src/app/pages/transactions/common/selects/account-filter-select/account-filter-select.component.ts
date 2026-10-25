import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Account } from '@common/accounts/account.model';

/** Account filter: one account (archived ones too, for history) or all; '' means all. */
@Component({
  selector: 'app-account-filter-select',
  imports: [MatFormFieldModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.filter.account">Account</mat-label>
      <mat-select [formControl]="control()">
        <mat-option value="" i18n="@@transactions.filter.account.all">All accounts</mat-option>
        @for (account of accounts(); track account.id) {
          <mat-option [value]="account.id">
            {{ account.name }}
            @if (account.isArchived) {
              <span class="archived"
                >(<ng-container i18n="@@common.badge.archived">Archived</ng-container>)</span
              >
            }
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-form-field {
      width: 100%;
    }

    .archived {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AccountFilterSelectComponent {
  readonly control = input.required<FormControl<string>>();
  readonly accounts = input.required<readonly Account[]>();
}
