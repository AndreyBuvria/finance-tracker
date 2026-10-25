import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Like `Validators.required`, but whitespace-only text counts as empty too:
 * `{ required: true }` for `''`, `'   '` and other blank values.
 */
export const notBlankValidator: ValidatorFn = (
  control: AbstractControl<string | null>,
): ValidationErrors | null => ((control.value ?? '').trim() === '' ? { required: true } : null);
