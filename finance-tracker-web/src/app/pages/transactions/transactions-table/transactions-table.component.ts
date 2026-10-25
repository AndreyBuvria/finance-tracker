import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Category } from '@common/categories/category.model';
import { Transaction, TransactionSort } from '@common/transactions/transaction.model';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';
import { AccountLabelComponent } from '../common/display/account-label/account-label.component';
import { CategoryChipComponent } from '../common/categories/category-chip/category-chip.component';
import { CategoryChange } from '../common/models/category-change.model';
import { CategoryChoicesByType } from '../common/models/category-choices.model';
import { SourceBadgeComponent } from '../common/display/source-badge/source-badge.component';
import { TransactionAmountComponent } from '../common/display/transaction-amount/transaction-amount.component';
import { editRowLabel, isFromControl, selectRowLabel } from '../utils/row-label.utils';
import { parseSort, toSort, transactionTitle } from '../utils/transaction-display.utils';

/**
 * Desktop transactions table (DESIGN.md "Transactions"): checkbox, Date, Merchant/Note, Category
 * (clickable chip), Account, Amount (right-aligned), Source. Sorting happens on the server; this
 * component only reports the chosen column and direction.
 */
@Component({
  selector: 'app-transactions-table',
  imports: [
    AccountLabelComponent,
    CategoryChipComponent,
    DatePipe,
    MatCheckboxModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    SourceBadgeComponent,
    TransactionAmountComponent,
  ],
  templateUrl: './transactions-table.component.html',
  styleUrl: './transactions-table.component.scss',
})
export class TransactionsTableComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly rows = input.required<readonly Transaction[]>();
  readonly sort = input.required<TransactionSort>();
  readonly selectedIds = input.required<ReadonlySet<string>>();
  readonly choices = input.required<CategoryChoicesByType>();
  /** Rows whose category change is being saved. */
  readonly savingIds = input<ReadonlySet<string>>(new Set());
  /** Row showing the "Saved" confirmation. */
  readonly savedId = input<string | null>(null);

  readonly sortChange = output<TransactionSort>();
  readonly toggled = output<string>();
  readonly allToggled = output<void>();
  readonly categoryChanged = output<CategoryChange>();
  /** Row clicked (or its title activated from the keyboard): open the edit dialog. */
  readonly editRequested = output<Transaction>();

  protected readonly columns = [
    'select',
    'date',
    'merchant',
    'category',
    'account',
    'amount',
    'source',
  ];
  protected readonly fields = TransactionSortFieldEnum;

  readonly activeSort = computed(() => parseSort(this.sort()));
  readonly allSelected = computed(
    () => this.rows().length > 0 && this.rows().every((row) => this.selectedIds().has(row.id)),
  );
  readonly someSelected = computed(
    () => !this.allSelected() && this.rows().some((row) => this.selectedIds().has(row.id)),
  );

  readonly trackById = (_: number, transaction: Transaction) => transaction.id;

  /** Typed access to the row in `*matCellDef` templates. */
  row(value: Transaction): Transaction {
    return value;
  }

  selectLabel(transaction: Transaction): string {
    return selectRowLabel(transaction, this.locale);
  }

  title(transaction: Transaction): string {
    return transactionTitle(transaction);
  }

  editLabel(transaction: Transaction): string {
    return editRowLabel(transaction, this.locale);
  }

  /** A click anywhere on the row edits it, except on its own controls (checkbox, chip, badge). */
  onRowClick(event: MouseEvent, transaction: Transaction): void {
    if (!isFromControl(event)) {
      this.editRequested.emit(transaction);
    }
  }

  changeCategory(transaction: Transaction, category: Category): void {
    this.categoryChanged.emit({ transaction, category });
  }

  onSort(sort: Sort): void {
    if (sort.direction) {
      this.sortChange.emit(toSort(sort.active as TransactionSortFieldEnum, sort.direction));
    }
  }
}
