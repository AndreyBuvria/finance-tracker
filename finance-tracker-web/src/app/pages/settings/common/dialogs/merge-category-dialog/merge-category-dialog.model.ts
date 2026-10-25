import { Category, MergeCategoryResult } from '@common/categories/category.model';

export interface MergeCategoryDialogData {
  /** The category to merge away. */
  readonly source: Category;
  /** Active categories of the same type to choose from. */
  readonly targets: readonly Category[];
}

/** How the dialog closed (closing without a result = cancelled). */
export type MergeCategoryDialogResult =
  | { readonly status: 'merged'; readonly result: MergeCategoryResult }
  /** The source or target no longer exists. */
  | { readonly status: 'notFound' };
