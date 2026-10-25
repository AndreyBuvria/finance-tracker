import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from './problem-details.model';

function problemOf(error: unknown): ProblemDetails | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as ProblemDetails) : null;
}

/**
 * First validation message per field from a 400 ProblemDetails response. The API keys `errors` by
 * camelCase field name, which matches the form control names; a leading capital is lowered just in
 * case (`"Email"` → `email`).
 */
export function validationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(problemOf(error)?.errors ?? {})) {
    if (field && messages?.length) {
      result[field.charAt(0).toLowerCase() + field.slice(1)] = messages[0];
    }
  }
  return result;
}

/** True for an HTTP error with the given status. */
export function hasStatus(error: unknown, status: number): boolean {
  return error instanceof HttpErrorResponse && error.status === status;
}

/**
 * The user-facing `detail` of a ProblemDetails response with the given status (e.g. a 409 "An
 * account with this name already exists."), or null when the error is something else.
 */
export function problemDetail(error: unknown, status: number): string | null {
  if (!hasStatus(error, status)) {
    return null;
  }
  const detail = problemOf(error)?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : null;
}

/** The request trace ID to show as "Error ID" on an unexpected error, or null if there is none. */
export function errorId(error: unknown): string | null {
  const traceId = problemOf(error)?.traceId;
  return typeof traceId === 'string' && traceId.trim() ? traceId : null;
}
