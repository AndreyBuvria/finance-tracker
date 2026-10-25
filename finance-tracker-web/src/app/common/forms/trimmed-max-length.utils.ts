import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Like `Validators.maxLength`, but measures the value without leading and trailing whitespace,
 * because that is what is sent to (and checked by) the API. Returns the same `maxlength` error.
 */
export function trimmedMaxLengthValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const actualLength = (control.value ?? '').trim().length;
    return actualLength > maxLength
      ? { maxlength: { requiredLength: maxLength, actualLength } }
      : null;
  };
}
