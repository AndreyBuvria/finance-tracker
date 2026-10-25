import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { startOfMonth } from '@common/date/month.utils';
import { ADD_INTENT_PARAM, ADD_INTENT_VALUE } from '@common/routing/route-intents.constants';
import { errorId } from '@common/http/problem-details.utils';
import { ClockService } from '@common/time/clock.service';
import { TransactionPage, TransactionSort } from '@common/transactions/transaction.model';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { LoadErrorComponent } from '@infrastructure/feedback/load-error/load-error.component';
import { registerHeaderActions } from '@infrastructure/layout/header-actions/header-actions.service';
import { DESKTOP_QUERY } from '@infrastructure/layout/layout.constants';
import { map } from 'rxjs';
import { BulkBarComponent } from './bulk-bar/bulk-bar.component';
import { TRANSACTION_QUERY_PARAMS } from './common/constants/transactions-page.constants';
import { CategoryChoicesByType } from './common/models/category-choices.model';
import { TransactionFiltersChange } from './common/models/transaction-filters.model';
import { FilterBarComponent } from './filter-bar/filter-bar.component';
import { FilterChipsComponent } from './filter-chips/filter-chips.component';
import { PagerComponent } from './pager/pager.component';
import { TransactionActionsService } from './transaction-actions.service';
import { TransactionEditorService } from './transaction-editor.service';
import { TransactionsEmptyComponent } from './transactions-empty/transactions-empty.component';
import { TransactionsFooterComponent } from './transactions-footer/transactions-footer.component';
import { TransactionsListComponent } from './transactions-list/transactions-list.component';
import { TransactionsSkeletonComponent } from './transactions-skeleton/transactions-skeleton.component';
import { TransactionsTableComponent } from './transactions-table/transactions-table.component';
import { categoryChoices } from './utils/category-choices.utils';
import { sortAnnouncement } from './utils/sort-announcement.utils';
import { parseSort } from './utils/transaction-display.utils';
import {
  clearedFilters,
  hasActiveFilters,
  parseFilters,
  toListQuery,
  toQueryParams,
} from './utils/transaction-filters.utils';

/**
 * Transactions (FEATURES.md F3/F4, DESIGN.md "Transactions"): filters kept in the URL, a sortable
 * table on desktop and a list grouped by day on mobile, server-side paging and sorting, footer
 * totals. Changes (inline category change, bulk recategorize/delete) go through the page-scoped
 * `TransactionActionsService`; Quick add and editing a row through `TransactionEditorService`.
 * Registers the primary "Add" header action (shortcut `N`) and opens Quick add for `?add=1`.
 */
@Component({
  selector: 'app-transactions',
  imports: [
    BulkBarComponent,
    FilterBarComponent,
    FilterChipsComponent,
    LoadErrorComponent,
    PagerComponent,
    TransactionsEmptyComponent,
    TransactionsFooterComponent,
    TransactionsListComponent,
    TransactionsSkeletonComponent,
    TransactionsTableComponent,
  ],
  providers: [TransactionActionsService, TransactionEditorService],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
  host: { '[class.desktop]': 'isDesktop()' },
})
export class TransactionsComponent {
  private readonly api = inject(TransactionsApiService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly scroller = inject(ViewportScroller);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly injector = inject(Injector);
  readonly actions = inject(TransactionActionsService);
  readonly editor = inject(TransactionEditorService);

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  /** Default month: the current Europe/Warsaw month (PLAN.md §6 "Dates"). */
  private readonly currentMonth = startOfMonth(inject(ClockService).businessToday());

  readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(DESKTOP_QUERY) },
  );

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly filters = computed(() => parseFilters(this.queryParams(), this.currentMonth));
  readonly query = computed(() => toListQuery(this.filters()), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  readonly activeFilters = computed(() => hasActiveFilters(this.filters()));
  /** Days are grouped on mobile only while sorted by date. */
  readonly sortedByDate = computed(
    () => parseSort(this.filters().sort).field === TransactionSortFieldEnum.Date,
  );

  readonly transactions = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });
  readonly accounts = rxResource({ stream: () => this.accountsApi.list(true) });
  readonly categories = rxResource({
    stream: () => this.categoriesApi.list({ includeArchived: true }),
  });

  /** The page to show: the previous one stays (dimmed) while the next one loads. */
  readonly page = linkedSignal<
    { value: TransactionPage | undefined; loading: boolean },
    TransactionPage | undefined
  >({
    source: () => ({
      value: this.transactions.hasValue() ? this.transactions.value() : undefined,
      loading: this.transactions.isLoading(),
    }),
    computation: (source, previous) =>
      source.value ?? (source.loading ? previous?.value : undefined),
  });

  /**
   * When nothing matches: does the user have any transactions at all? Decides between the two
   * empty states (FEATURES.md F3).
   */
  readonly anyTransactions = rxResource({
    params: () => (this.page()?.totalCount === 0 ? this.query() : undefined),
    stream: () => this.api.list({ pageSize: 1 }).pipe(map((page) => page.totalCount > 0)),
  });
  readonly emptyKind = computed<'none' | 'noMatches' | null>(() => {
    if (!this.anyTransactions.hasValue()) {
      return null;
    }
    return this.anyTransactions.value() ? 'noMatches' : 'none';
  });

  readonly loadErrorId = computed(() => errorId(this.transactions.error()));
  readonly emptyCheckErrorId = computed(() => errorId(this.anyTransactions.error()));
  readonly accountList = computed(() =>
    this.accounts.hasValue() ? this.accounts.value().items : [],
  );
  readonly categoryList = computed(() =>
    this.categories.hasValue() ? this.categories.value().items : [],
  );
  readonly choices = computed<CategoryChoicesByType>(() => ({
    [TransactionTypeEnum.Expense]:
      categoryChoices([TransactionTypeEnum.Expense], this.categoryList()) ?? [],
    [TransactionTypeEnum.Income]:
      categoryChoices([TransactionTypeEnum.Income], this.categoryList()) ?? [],
  }));

  /** Selected rows of the current page; a new query starts with none. */
  readonly selectedIds = linkedSignal<unknown, ReadonlySet<string>>({
    source: () => this.query(),
    computation: () => new Set<string>(),
  });
  readonly selectedRows = computed(() =>
    (this.page()?.items ?? []).filter((row) => this.selectedIds().has(row.id)),
  );
  readonly bulkChoices = computed(() =>
    categoryChoices(
      this.selectedRows().map((row) => row.type),
      this.categoryList(),
    ),
  );

  constructor() {
    this.actions.connect({
      page: () => this.page(),
      selectedRows: () => this.selectedRows(),
      reload: () => this.transactions.reload(),
      clearSelection: () => this.selectedIds.set(new Set()),
      goToPage: (page) => this.changePage(page),
      focusAfterBulk: (rowsRemoved) => this.focusAfterBulk(rowsRemoved),
    });

    this.editor.connect({
      reload: () => this.transactions.reload(),
      focusAfterBulk: (rowsRemoved) => this.focusAfterBulk(rowsRemoved),
    });

    registerHeaderActions([
      {
        id: 'add-transaction',
        label: $localize`:@@transactions.action.add:Add`,
        accessibleLabel: $localize`:@@transactions.action.add.label:Add transaction`,
        icon: 'add',
        shortcut: 'N',
        primary: true,
        handler: () => this.editor.openQuickAdd(),
      },
    ]);

    // Keep the month in the URL, so a copied link shows the same month later, and handle the
    // `?add=1` intent (another page asks for Quick add): open it and remove the param.
    effect(() => {
      const params = this.queryParams();
      const addIntent = params.get(ADD_INTENT_PARAM) === ADD_INTENT_VALUE;
      if (params.has(TRANSACTION_QUERY_PARAMS.month) && !params.has(ADD_INTENT_PARAM)) {
        return;
      }
      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: toQueryParams(this.filters()),
          replaceUrl: true,
        });
        if (addIntent) {
          this.editor.openQuickAdd();
        }
      });
    });
  }

  /** Writes a filter change to the URL; any change but paging goes back to page 1. */
  update(change: TransactionFiltersChange): void {
    const next = { ...this.filters(), page: 1, ...change };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(next),
    });
  }

  changeSort(sort: TransactionSort): void {
    this.update({ sort });
    this.announcer.announce(sortAnnouncement(sort));
  }

  changePage(page: number): void {
    this.update({ page });
    this.scroller.scrollToPosition([0, 0]);
  }

  clearFilters(): void {
    this.update(clearedFilters(this.filters()));
  }

  toggle(id: string): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  toggleAll(): void {
    const rows = this.page()?.items ?? [];
    const all = rows.length > 0 && rows.every((row) => this.selectedIds().has(row.id));
    this.selectedIds.set(new Set(all ? [] : rows.map((row) => row.id)));
  }

  /**
   * After a bulk action the bulk bar (with the focused button) disappears: focus the results, or
   * the heading when rows were removed and the list may be replaced by an empty state.
   */
  private focusAfterBulk(rowsRemoved: boolean): void {
    afterNextRender(
      () => {
        const target = (!rowsRemoved && this.results()) || this.heading();
        target.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
}
