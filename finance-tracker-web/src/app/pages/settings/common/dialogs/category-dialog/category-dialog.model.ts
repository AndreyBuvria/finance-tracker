import { Category } from '@common/categories/category.model';

export interface CategoryDialogData {
  /** The category to edit; none to add one. */
  readonly category?: Category;
}

/** How the dialog closed (closing without a result = cancelled). */
export type CategoryDialogResult =
  | { readonly status: 'saved'; readonly category: Category }
  /** The edited category no longer exists. */
  | { readonly status: 'notFound' };

/** Why a category's type can't change: a default one, or a custom one already in use. */
export type CategoryTypeLock = 'default' | 'inUse' | null;
