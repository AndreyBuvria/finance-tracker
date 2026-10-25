import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseAmountInput } from '@common/formatting/amount-input.utils';

/** The amount typed in a filter field, or null when blank or unreadable. */
export function amountFilterValue(text: string): number | null {
  const result = parseAmountInput(text);
  return result.kind === 'ok' ? result.value : null;
}

/** Error `amountNegative` ("Enter an amount of 0 or more.") for a value below 0. */
export const nonNegativeAmountValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = amountFilterValue(control.value ?? '');
  return value !== null && value < 0 ? { amountNegative: true } : null;
};

/**
 * Group validator for `{ min, max }`: error `amountRangeReversed` ("Maximum amount can't be less
 * than minimum amount.") on the group when both are set and max < min.
 */
export const amountRangeValidator: ValidatorFn = (
  group: AbstractControl<{ min: string; max: string }>,
): ValidationErrors | null => {
  const min = amountFilterValue(group.value?.min ?? '');
  const max = amountFilterValue(group.value?.max ?? '');
  return min !== null && max !== null && max < min ? { amountRangeReversed: true } : null;
};
