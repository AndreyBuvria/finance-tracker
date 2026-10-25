import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';
import { TransactionAccount } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { map, tap } from 'rxjs';
import { categoryChoices } from '../../../utils/category-choices.utils';
import { TOP_CATEGORY_COUNT } from '../../constants/transaction-limits.constants';
import { QuickAddDialogData } from './quick-add-dialog.model';

/**
 * The accounts and categories the Quick add / edit dialog needs (FEATURES.md F3), with their
 * loading state. The most used categories follow the form's type (`connect()`); while a type switch
 * reloads them, the type's categories from the full list stand in, so the form stays in place: the
 * skeleton is for the first load only. Lives as long as the dialog.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- dialog-scoped: QuickAddDialogComponent provides it, so its lists start and end with the dialog.
@Injectable()
export class QuickAddListsService {
  private readonly accountsApi = inject(AccountsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly editing =
    inject<QuickAddDialogData | null>(MAT_DIALOG_DATA, { optional: true })?.transaction ?? null;

  /** The form's transaction type, once connected. */
  private readonly typeSource = signal<Signal<TransactionTypeEnum>>(
    signal(this.editing?.type ?? TransactionTypeEnum.Expense),
  );
  private readonly type = computed(() => this.typeSource()());

  /**
   * Set once the most used categories have arrived the first time; a type switch reloading them
   * later doesn't count as loading. Set by the request itself, so it doesn't depend on who reads it.
   */
  private readonly topLoadedOnce = signal(false);

  readonly accounts = rxResource({ stream: () => this.accountsApi.list(false) });
  private readonly topCategories = rxResource({
    params: () => (this.type() === TransactionTypeEnum.Transfer ? undefined : this.categoryType()),
    stream: ({ params }) =>
      this.categoriesApi.top({ limit: TOP_CATEGORY_COUNT, type: params }).pipe(
        map((list) => list.items),
        tap(() => this.topLoadedOnce.set(true)),
      ),
  });
  /** Every active category, for "More" and for checking a kept category. */
  readonly allCategories = rxResource({
    stream: () => this.categoriesApi.list().pipe(map((list) => list.items)),
  });

  /** Active accounts, plus the edited row's archived ones (an unchanged archived account may stay). */
  readonly accountOptions = computed<readonly TransactionAccount[]>(() => {
    const active: TransactionAccount[] = this.accounts.hasValue()
      ? this.accounts.value().items
      : [];
    const kept = [
      this.editing?.account,
      this.editing?.transfer?.fromAccount,
      this.editing?.transfer?.toAccount,
    ].filter((a): a is TransactionAccount => !!a && !active.some((b) => b.id === a.id));
    return [...active, ...kept];
  });

  /** The category tiles: the most used ones for the type (or stand-ins while they reload). */
  readonly topTiles = computed<readonly Category[]>(() => {
    if (this.topCategories.hasValue()) {
      return this.topCategories.value();
    }
    const wanted = this.categoryType();
    const all = this.allCategories.hasValue() ? this.allCategories.value() : [];
    return all.filter((category) => category.type === wanted).slice(0, TOP_CATEGORY_COUNT);
  });
  /** Everything selectable under "More", grouped. */
  readonly categoryGroups = computed(
    () =>
      categoryChoices(
        [this.type()],
        this.allCategories.hasValue() ? this.allCategories.value() : [],
      ) ?? [],
  );

  /** Still loading (a type switch reloading the tiles doesn't count). */
  readonly loading = computed(
    () =>
      this.accounts.isLoading() ||
      this.allCategories.isLoading() ||
      (this.topCategories.isLoading() && !this.topLoadedOnce()),
  );
  /** A list couldn't be loaded: the form can't be filled in. */
  readonly loadFailed = computed(
    () => !!this.accounts.error() || !!this.allCategories.error() || !!this.topCategories.error(),
  );

  /** Makes the tiles follow the form's type. Call once, before the first render. */
  connect(type: Signal<TransactionTypeEnum>): void {
    this.typeSource.set(type);
  }

  /** Loads again whatever failed. */
  retry(): void {
    for (const resource of [this.accounts, this.allCategories, this.topCategories]) {
      if (resource.error()) {
        resource.reload();
      }
    }
  }

  /** The category type whose tiles the transaction type shows. */
  private categoryType(): CategoryTypeEnum {
    return this.type() === TransactionTypeEnum.Income
      ? CategoryTypeEnum.Income
      : CategoryTypeEnum.Expense;
  }
}
