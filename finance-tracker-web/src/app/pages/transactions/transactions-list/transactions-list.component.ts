import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '@common/categories/category.model';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { Transaction } from '@common/transactions/transaction.model';
import { AccountLabelComponent } from '../common/display/account-label/account-label.component';
import { CategoryChipComponent } from '../common/categories/category-chip/category-chip.component';
import { CategoryChange } from '../common/models/category-change.model';
import { CategoryChoicesByType } from '../common/models/category-choices.model';
import { SourceBadgeComponent } from '../common/display/source-badge/source-badge.component';
import { TransactionAmountComponent } from '../common/display/transaction-amount/transaction-amount.component';
import { editRowLabel, isFromControl, selectRowLabel } from '../utils/row-label.utils';
import { DayGroup } from '../common/models/day-group.model';
import { groupByDay, signedTotal, transactionTitle } from '../utils/transaction-display.utils';

/** "Mon, 19 Oct" in day headers (DESIGN.md "Transactions", mobile). */
const DAY_HEADER_FORMAT = 'EEE, d MMM';

/**
 * Mobile transactions: a card list grouped by day with the day's total in the header
 * ("Mon, 19 Oct · −86,40 zł", FEATURES.md F3). Days are only grouped when the list is sorted by
 * date; with another sort order each card shows its date instead.
 */
@Component({
  selector: 'app-transactions-list',
  imports: [
    AccountLabelComponent,
    CategoryChipComponent,
    DatePipe,
    MatCheckboxModule,
    MatIconModule,
    MoneyPipe,
    SourceBadgeComponent,
    TransactionAmountComponent,
  ],
  templateUrl: './transactions-list.component.html',
  styleUrl: './transactions-list.component.scss',
})
export class TransactionsListComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly rows = input.required<readonly Transaction[]>();
  /** Group by day (the list is sorted by date). */
  readonly grouped = input(true);
  readonly selectedIds = input.required<ReadonlySet<string>>();
  readonly choices = input.required<CategoryChoicesByType>();
  readonly savingIds = input<ReadonlySet<string>>(new Set());
  readonly savedId = input<string | null>(null);

  readonly toggled = output<string>();
  readonly categoryChanged = output<CategoryChange>();
  /** Card clicked (or its title activated from the keyboard): open the edit dialog. */
  readonly editRequested = output<Transaction>();

  protected readonly dayFormat = DAY_HEADER_FORMAT;

  /** Day groups, or one group without a header when not grouped. */
  readonly groups = computed<(DayGroup & { readonly heading: boolean })[]>(() =>
    this.grouped()
      ? groupByDay(this.rows()).map((group) => ({ ...group, heading: true }))
      : [{ date: 'all', items: this.rows(), total: 0, heading: false }],
  );

  dayTotal(group: DayGroup) {
    return signedTotal(group.total);
  }

  title(transaction: Transaction): string {
    return transactionTitle(transaction);
  }

  selectLabel(transaction: Transaction): string {
    return selectRowLabel(transaction, this.locale);
  }

  editLabel(transaction: Transaction): string {
    return editRowLabel(transaction, this.locale);
  }

  /** A click anywhere on the card edits it, except on its own controls. */
  onCardClick(event: MouseEvent, transaction: Transaction): void {
    if (!isFromControl(event)) {
      this.editRequested.emit(transaction);
    }
  }

  changeCategory(transaction: Transaction, category: Category): void {
    this.categoryChanged.emit({ transaction, category });
  }
}
