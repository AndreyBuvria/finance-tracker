import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Up to 13 integer digits (9 999 999 999 999,99): amounts travel as JS numbers, which keep every
 * cent exact only up to about 15 significant digits. The API itself allows more.
 */
const MAX_INTEGER_DIGITS = 13;

/** Spaces users type or paste as thousands separators (space, no-break, narrow no-break). */
const GROUPING_SPACES = /[\s\u00a0\u202f]/g;

const AMOUNT_PATTERN = /^([-\u2212]?)(\d*)(?:[.,](\d*))?$/;

export type AmountParseResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'tooManyDecimals' }
  | { readonly kind: 'tooLarge' }
  | { readonly kind: 'ok'; readonly value: number };

/**
 * Reads an amount typed in Polish or English style: "1 234,56", "1234.56", "-50", "−12,5".
 * Thousands may be grouped with spaces only. A blank field is `empty` (the caller decides what
 * that means, e.g. a starting balance of 0).
 */
export function parseAmountInput(text: string): AmountParseResult {
  const compact = text.replace(GROUPING_SPACES, '');
  if (compact === '') {
    return { kind: 'empty' };
  }
  const match = AMOUNT_PATTERN.exec(compact);
  if (!match || (match[2] === '' && !match[3])) {
    return { kind: 'invalid' };
  }
  const [, sign, integer, fraction = ''] = match;
  if (fraction.length > 2) {
    return { kind: 'tooManyDecimals' };
  }
  if (integer.replace(/^0+/, '').length > MAX_INTEGER_DIGITS) {
    return { kind: 'tooLarge' };
  }
  const value = Number(`${integer || '0'}.${fraction || '0'}`);
  return { kind: 'ok', value: sign && value !== 0 ? -value : value };
}

/**
 * Validator for an amount text field. Errors: `amountInvalid`, `amountDecimals`, `amountTooLarge`.
 * A blank value is valid (combine with a required validator when needed).
 */
export const amountInputValidator: ValidatorFn = (
  control: AbstractControl<string | null>,
): ValidationErrors | null => {
  switch (parseAmountInput(control.value ?? '').kind) {
    case 'invalid':
      return { amountInvalid: true };
    case 'tooManyDecimals':
      return { amountDecimals: true };
    case 'tooLarge':
      return { amountTooLarge: true };
    default:
      return null;
  }
};

/** An amount as editable text in Polish style, without grouping: 1234.5 → "1234,50", -3 → "-3,00". */
export function formatAmountInput(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
