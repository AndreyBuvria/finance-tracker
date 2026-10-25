import { Category } from '@common/categories/category.model';

/** Categories offered in a picker under one heading (e.g. "Income", "Expense"). */
export interface CategoryGroup {
  readonly label: string;
  readonly categories: readonly Category[];
}
