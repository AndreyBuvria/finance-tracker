import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Category } from '@common/categories/category.model';
import { parseAmountInput } from '@common/formatting/amount-input.utils';
import {
  BUDGET_CATEGORY_KEYS,
  BudgetCategoryKey,
} from '../common/constants/budget-categories.constants';

/** A step 2 row: the category and the form control it uses. */
export interface BudgetCategoryRow {
  readonly key: BudgetCategoryKey;
  readonly category: Category;
}

/**
 * The step 2 categories found among the user's active ones, by `systemKey`, in display order. A
 * default the user hid (or merged away) is left out.
 */
export function budgetCategoryRows(categories: readonly Category[]): BudgetCategoryRow[] {
  return BUDGET_CATEGORY_KEYS.flatMap((key) => {
    const category = categories.find((c) => c.systemKey === key && !c.isArchived);
    return category ? [{ key, category }] : [];
  });
}

/** Validator: `amountNegative` for a limit below 0 ("Enter an amount of 0 or more."). */
export const nonNegativeAmountValidator: ValidatorFn = (
  control: AbstractControl<string | null>,
): ValidationErrors | null => {
  const result = parseAmountInput(control.value ?? '');
  return result.kind === 'ok' && result.value < 0 ? { amountNegative: true } : null;
};

/**
 * The limit to send for a (valid) field: a blank field or 0 means "no budget" (`null`, which the
 * API treats as a removal).
 */
export function limitFromInput(text: string): number | null {
  const result = parseAmountInput(text);
  return result.kind === 'ok' && result.value > 0 ? result.value : null;
}
