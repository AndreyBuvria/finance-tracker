/**
 * Step 2 rows: the 5 most common categories, by `systemKey`, in display order (FEATURES.md F1:
 * Groceries, Eating out, Transport, Shopping, Entertainment).
 */
export const BUDGET_CATEGORY_KEYS = [
  'groceries',
  'eating_out',
  'transport',
  'shopping',
  'entertainment',
] as const;

export type BudgetCategoryKey = (typeof BUDGET_CATEGORY_KEYS)[number];
