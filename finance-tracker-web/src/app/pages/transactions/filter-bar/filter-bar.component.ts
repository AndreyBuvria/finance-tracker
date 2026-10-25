import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Account } from '@common/accounts/account.model';
import { Category } from '@common/categories/category.model';
import { MonthSelectComponent } from '@common/date/month-select/month-select.component';
import { parseIsoDate, toIsoDate } from '@common/date/iso-date.utils';
import { amountInputValidator, formatAmountInput } from '@common/formatting/amount-input.utils';
import { MONTH_FORMAT } from '@common/formatting/date-formats.constants';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { DESKTOP_QUERY } from '@infrastructure/layout/layout.constants';
import { debounceTime, filter, map, merge } from 'rxjs';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
} from '../common/constants/transaction-type.constants';
import {
  AMOUNT_DEBOUNCE_MS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
} from '../common/constants/transactions-page.constants';
import {
  TransactionFilters,
  TransactionFiltersChange,
} from '../common/models/transaction-filters.model';
import { AmountRangeComponent } from './amount-range/amount-range.component';
import { AccountFilterSelectComponent } from '../common/selects/account-filter-select/account-filter-select.component';
import { CategoryFilterSelectComponent } from '../common/selects/category-filter-select/category-filter-select.component';
import {
  amountFilterValue,
  amountRangeValidator,
  nonNegativeAmountValidator,
} from '../utils/amount-filter.utils';
import { hasDateRange } from '../utils/transaction-filters.utils';

/**
 * Filter bar (FEATURES.md F3, DESIGN.md "Transactions"): month, search, date range, account,
 * categories, type and amount range. It shows the URL state it gets and reports changes; the page
 * writes them to the URL. Search and amounts wait for a pause in typing. On mobile the filters
 * below the search are collapsed behind a "Filters" button.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [
    AccountFilterSelectComponent,
    AmountRangeComponent,
    DatePipe,
    CategoryFilterSelectComponent,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MonthSelectComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  readonly filters = input.required<TransactionFilters>();
  readonly accounts = input<readonly Account[]>([]);
  readonly categories = input<readonly Category[]>([]);

  readonly filtersChange = output<TransactionFiltersChange>();

  protected readonly types = TRANSACTION_TYPES;
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly monthFormat = MONTH_FORMAT;

  private readonly breakpoints = inject(BreakpointObserver);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(DESKTOP_QUERY) },
  );
  /** Mobile: the filters below the search are shown. */
  readonly expanded = signal(false);

  readonly month = computed(() => this.filters().month);
  /** A date range replaces the month: the month selector is shown as inactive. */
  readonly rangeActive = computed(() => hasDateRange(this.filters()));

  readonly form = this.fb.group({
    q: ['', Validators.maxLength(SEARCH_MAX_LENGTH)],
    range: this.fb.group({
      start: this.fb.control<Date | null>(null),
      end: this.fb.control<Date | null>(null),
    }),
    accountId: [''],
    categoryIds: this.fb.control<string[]>([]),
    type: this.fb.control<TransactionTypeEnum | ''>(''),
    amount: this.fb.group(
      {
        min: ['', [amountInputValidator, nonNegativeAmountValidator]],
        max: ['', [amountInputValidator, nonNegativeAmountValidator]],
      },
      { validators: amountRangeValidator },
    ),
  });

  constructor() {
    // URL → form (also after Back or a removed chip), without reporting it back.
    effect(() => {
      const filters = this.filters();
      untracked(() => this.showFilters(filters));
    });

    const c = this.form.controls;
    merge(
      c.q.valueChanges.pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        filter(() => c.q.valid),
        map((q): TransactionFiltersChange => ({ q: q.trim() })),
      ),
      c.accountId.valueChanges.pipe(map((id) => ({ accountId: id || null }))),
      c.categoryIds.valueChanges.pipe(map((ids) => ({ categoryIds: ids }))),
      c.type.valueChanges.pipe(map((type) => ({ type: type || null }))),
      c.range.valueChanges.pipe(
        // Wait for both ends (the picker sets the start first); both empty clears the range.
        filter(({ start, end }) => c.range.valid && !start === !end),
        map(({ start, end }) => ({
          from: start ? toIsoDate(start) : null,
          to: end ? toIsoDate(end) : null,
        })),
      ),
      c.amount.valueChanges.pipe(
        debounceTime(AMOUNT_DEBOUNCE_MS),
        filter(() => c.amount.valid),
        map(({ min, max }) => ({
          minAmount: amountFilterValue(min ?? ''),
          maxAmount: amountFilterValue(max ?? ''),
        })),
      ),
    )
      .pipe(
        filter((change) => differs(change, this.filters())),
        takeUntilDestroyed(),
      )
      .subscribe((change) => this.filtersChange.emit(change));
  }

  /** Another month replaces the date range. */
  selectMonth(month: Date): void {
    this.filtersChange.emit({ month, from: null, to: null });
  }

  clearSearch(): void {
    this.form.controls.q.setValue('', { emitEvent: false });
    if (this.filters().q) {
      this.filtersChange.emit({ q: '' });
    }
  }

  /** Puts the URL state into the fields, keeping what the user typed when it means the same. */
  private showFilters(filters: TransactionFilters): void {
    const c = this.form.controls;
    const quiet = { emitEvent: false };
    if (c.q.value.trim() !== filters.q) {
      c.q.setValue(filters.q, quiet);
    }
    const start = c.range.controls.start.value;
    const end = c.range.controls.end.value;
    if ((start && toIsoDate(start)) !== filters.from || (end && toIsoDate(end)) !== filters.to) {
      c.range.setValue({ start: parseIsoDate(filters.from), end: parseIsoDate(filters.to) }, quiet);
    }
    c.accountId.setValue(filters.accountId ?? '', quiet);
    if (!sameValue(c.categoryIds.value, filters.categoryIds)) {
      c.categoryIds.setValue([...filters.categoryIds], quiet);
    }
    c.type.setValue(filters.type ?? '', quiet);
    const amount = c.amount.controls;
    if (amountFilterValue(amount.min.value) !== filters.minAmount) {
      amount.min.setValue(amountText(filters.minAmount), quiet);
    }
    if (amountFilterValue(amount.max.value) !== filters.maxAmount) {
      amount.max.setValue(amountText(filters.maxAmount), quiet);
    }
    c.amount.updateValueAndValidity(quiet);
  }
}

function amountText(value: number | null): string {
  return value === null ? '' : formatAmountInput(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether the change sets anything to a new value. */
function differs(change: TransactionFiltersChange, filters: TransactionFilters): boolean {
  return Object.entries(change).some(
    ([key, value]) => !sameValue(value, filters[key as keyof TransactionFilters]),
  );
}
