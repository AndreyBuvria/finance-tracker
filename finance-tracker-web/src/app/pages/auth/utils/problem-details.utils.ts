import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '@common/auth/auth.model';

/**
 * First validation message per field from a 400 ProblemDetails response, with field names in
 * camelCase to match form control names (`"Email"` → `email`).
 */
export function validationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return {};
  }
  const problem = error.error as ProblemDetails | null;
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(problem?.errors ?? {})) {
    if (field && messages?.length) {
      result[field.charAt(0).toLowerCase() + field.slice(1)] = messages[0];
    }
  }
  return result;
}
