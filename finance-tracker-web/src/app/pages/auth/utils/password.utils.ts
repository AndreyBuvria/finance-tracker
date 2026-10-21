import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordChecks, PasswordRule } from '../common/password.model';

/** Password requirements (FEATURES.md F1): ≥ 8 characters, ≥ 1 letter, ≥ 1 number. */
export const PASSWORD_MIN_LENGTH = 8;

/** Which requirements `password` meets. Letters include Polish and other non-ASCII letters. */
export function checkPassword(password: string): PasswordChecks {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    letter: /\p{L}/u.test(password),
    number: /\p{Nd}/u.test(password),
  };
}

/**
 * Form validator: `{ passwordRules: { unmet: PasswordRule[] } }` while any requirement is unmet.
 * An empty value is left to `Validators.required`.
 */
export const passwordRulesValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value ?? '';
  if (value === '') {
    return null;
  }
  const checks = checkPassword(value);
  const unmet = (Object.keys(checks) as PasswordRule[]).filter((rule) => !checks[rule]);
  return unmet.length ? { passwordRules: { unmet } } : null;
};
