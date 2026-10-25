import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PASSWORD_MIN_LENGTH } from '../common/auth-limits.constants';
import { PasswordChecks } from '../common/password.model';

/**
 * Which requirements `password` meets (FEATURES.md F1), with the same rules as the API:
 * letters include Polish and other non-ASCII letters, but only ASCII digits 0–9 count as a number.
 */
export function checkPassword(password: string): PasswordChecks {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    letter: /\p{L}/u.test(password),
    number: /[0-9]/.test(password),
  };
}

/**
 * Form validator: `{ passwordLetterAndNumber: true }` while the password lacks a letter or an
 * ASCII digit. An empty value is left to `Validators.required`; length is checked by
 * `Validators.minLength`/`maxLength`.
 */
export const passwordLetterAndNumberValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const value = control.value ?? '';
  if (value === '') {
    return null;
  }
  const checks = checkPassword(value);
  return checks.letter && checks.number ? null : { passwordLetterAndNumber: true };
};
