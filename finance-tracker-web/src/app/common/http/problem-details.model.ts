/** RFC 7807 error body, as returned by every API error (PLAN.md §4). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Validation errors keyed by field name, e.g. `{ "email": ["…"] }`. */
  errors?: Record<string, string[]>;
  /** Request trace ID, shown small as the "Error ID" for support. */
  traceId?: string;
}
