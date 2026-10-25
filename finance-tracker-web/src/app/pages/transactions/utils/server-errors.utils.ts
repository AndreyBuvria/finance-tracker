import { AbstractControl } from '@angular/forms';
import { problemDetail, validationErrors } from '@common/http/problem-details.utils';
import { FormError } from '../common/models/form-error.model';

/** Fields of the Quick add form the API reports validation errors on (contract field names). */
export const QUICK_ADD_SERVER_FIELDS = [
  'amount',
  'categoryId',
  'merchant',
  'note',
  'date',
  'accountId',
  'fromAccountId',
  'toAccountId',
] as const;

export type QuickAddServerField = (typeof QUICK_ADD_SERVER_FIELDS)[number];

/**
 * Puts the API's validation messages on their controls (error `server`, marked touched). Returns
 * null when at least one field got its message, otherwise the form-level error: a message without
 * a field (e.g. on `type`), the `detail` of a 404/409, or `generic`.
 */
export function applyServerErrors(
  controls: Readonly<Record<QuickAddServerField, AbstractControl>>,
  error: unknown,
): FormError | null {
  const messages = validationErrors(error);
  const fields = QUICK_ADD_SERVER_FIELDS.filter((field) => messages[field]);
  if (fields.length === 0) {
    const message = messages['type'] ?? problemDetail(error, 404) ?? problemDetail(error, 409);
    return message ? { message } : 'generic';
  }
  for (const field of fields) {
    controls[field].setErrors({ server: messages[field] });
    controls[field].markAsTouched();
  }
  return null;
}
