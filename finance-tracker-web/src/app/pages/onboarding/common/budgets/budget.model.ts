/*
 * PLAN.md §7 "Budgets contract (Phase 1: set/remove one limit)". Route (under /api):
 * - PUT /budgets/{categoryId}?month=YYYY-MM { limitAmount } → 200 Budget (created or replaced);
 *   a limit of 0 or null removes it → 204 (also when there was none); 400 validation
 *   (e.g. "Enter an amount of 0 or more.", "Budgets can only be set for expense categories.",
 *   "This category is hidden. Choose an active category."); 404 unknown or another user's category.
 */

/** A monthly limit of one expense category. */
export interface Budget {
  categoryId: string;
  /** "YYYY-MM". */
  month: string;
  limitAmount: number;
}

/** Body of PUT /budgets/{categoryId}. `null` (or 0) removes the budget. */
export interface BudgetRequest {
  limitAmount: number | null;
}
