import { Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Account } from '@common/accounts/account.model';
import { AccountCardComponent } from '../account-card/account-card.component';

/** Collapsed "Archived accounts (n)" section (DESIGN.md "Accounts"); hidden when there are none. */
@Component({
  selector: 'app-archived-accounts',
  imports: [AccountCardComponent, MatButtonModule, MatIconModule],
  template: `
    @if (accounts().length > 0) {
      <h2 class="heading">
        <button
          matButton
          type="button"
          class="toggle"
          aria-controls="archived-accounts-list"
          [attr.aria-expanded]="expanded()"
          (click)="expanded.set(!expanded())"
        >
          <mat-icon aria-hidden="true">{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
          <span i18n="@@accounts.archived.heading"
            >Archived accounts ({{ accounts().length }})</span
          >
        </button>
      </h2>
      <ul id="archived-accounts-list" class="account-grid" [hidden]="!expanded()">
        @for (account of accounts(); track account.id) {
          <li>
            <app-account-card
              [account]="account"
              [headingLevel]="3"
              [busy]="busy()"
              (editRequested)="editRequested.emit($event)"
              (restoreRequested)="restoreRequested.emit($event)"
            />
          </li>
        }
      </ul>
    }
  `,
  styleUrls: ['../common/styles/account-grid.scss'],
  styles: `
    .heading {
      margin: 32px 0 8px;
      font: var(--mat-sys-title-medium);
    }

    .toggle {
      margin-left: -12px;
    }
  `,
})
export class ArchivedAccountsComponent {
  readonly accounts = input.required<readonly Account[]>();
  /** A change is in flight: all account actions are disabled. */
  readonly busy = input(false);

  readonly editRequested = output<Account>();
  readonly restoreRequested = output<Account>();

  readonly expanded = signal(false);
}
