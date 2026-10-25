import { computed, inject, Injectable, LOCALE_ID } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';
import { CATEGORY_TYPE_OPTIONS } from '../common/constants/category-type.constants';

/** The active categories of one type, as listed on the Settings page. */
export interface CategoryTypeGroup {
  readonly type: CategoryTypeEnum;
  readonly categories: readonly Category[];
}

/**
 * The user's categories for Settings → Categories (FEATURES.md F5): active ones by type, and the
 * hidden & archived ones. Changes made on the page are applied locally from the API's answers
 * (no reload), so the list stays in place and focus can move right away. Lives as long as the
 * section.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- section-scoped: CategoriesSettingsComponent provides it, so its list starts and ends with the section.
@Injectable()
export class CategoryListService {
  private readonly api = inject(CategoriesApiService);
  private readonly locale = inject(LOCALE_ID);

  /** Every category, archived ones included. */
  readonly categories = rxResource({ stream: () => this.api.list({ includeArchived: true }) });

  private readonly items = computed(() =>
    this.categories.hasValue() ? sortByName(this.categories.value().items, this.locale) : [],
  );

  /** Active categories: expense first, then income (DESIGN.md "Settings → Categories"). */
  readonly groups = computed<readonly CategoryTypeGroup[]>(() =>
    CATEGORY_TYPE_OPTIONS.map(({ type }) => ({
      type,
      categories: this.items().filter((c) => c.type === type && !c.isArchived),
    })),
  );

  /** Hidden defaults and archived custom categories. */
  readonly hidden = computed(() => this.items().filter((c) => c.isArchived));

  /** Active categories a category can be merged into: same type, not itself. */
  mergeTargets(source: Category): Category[] {
    return this.items().filter(
      (c) => !c.isArchived && c.type === source.type && c.id !== source.id,
    );
  }

  /** Adds a category or replaces it (by ID) with the API's answer. */
  put(category: Category): void {
    this.change((items) => [...items.filter((c) => c.id !== category.id), category]);
  }

  /** Marks a category hidden/archived or active again. */
  setArchived(id: string, isArchived: boolean): void {
    this.change((items) => items.map((c) => (c.id === id ? { ...c, isArchived } : c)));
  }

  remove(id: string): void {
    this.change((items) => items.filter((c) => c.id !== id));
  }

  /** After a merge: the source is archived and empty; the target has its new counts. */
  merged(sourceId: string, target: Category): void {
    this.change((items) =>
      items.map((c) => {
        if (c.id === target.id) {
          return target;
        }
        return c.id === sourceId
          ? { ...c, isArchived: true, transactionCount: 0, budgetCount: 0 }
          : c;
      }),
    );
  }

  private change(update: (items: readonly Category[]) => Category[]): void {
    this.categories.update((list) => (list ? { items: update(list.items) } : list));
  }
}

/** By name in the app's locale, ignoring case (as the API sorts). */
function sortByName(items: readonly Category[], locale: string): Category[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}
