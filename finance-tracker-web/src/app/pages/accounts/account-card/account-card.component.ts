import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Account } from '@common/accounts/account.model';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { accountTypeOption } from '../utils/account-type.utils';

/**
 * One account (DESIGN.md "Accounts"): type icon, name, balance, type label and a "⋮" menu.
 * Active: Edit, Archive. Archived: muted, "Archived" badge, a "Restore" button and Edit (to rename
 * before restoring).
 */
@Component({
  selector: 'app-account-card',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MoneyPipe],
  templateUrl: './account-card.component.html',
  styleUrl: './account-card.component.scss',
  host: { '[class.archived]': 'account().isArchived' },
})
export class AccountCardComponent {
  readonly account = input.required<Account>();
  /** Heading level of the account name in the page outline. */
  readonly headingLevel = input<2 | 3>(2);
  /** Disables the actions while a change to any account is in flight. */
  readonly busy = input(false);

  readonly editRequested = output<Account>();
  readonly archiveRequested = output<Account>();
  readonly restoreRequested = output<Account>();

  readonly typeOption = computed(() => accountTypeOption(this.account().type));
  /** Starts with the visible "Restore" (WCAG 2.5.3 "Label in Name"). */
  readonly restoreLabel = computed(
    () => $localize`:@@accounts.card.restoreLabel:Restore ${this.account().name}:name:`,
  );
  readonly menuLabel = computed(
    () => $localize`:@@accounts.card.menuLabel:More actions for ${this.account().name}:name:`,
  );
}
