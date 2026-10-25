import { HttpErrorResponse } from '@angular/common/http';
import { errorId, hasStatus, problemDetail, validationErrors } from './problem-details.utils';

describe('validationErrors', () => {
  it('returns the first message per field, keyed by the camelCase field name', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: {
          email: ['Enter a valid email address.', 'Second'],
          displayName: ['Name can be at most 100 characters.'],
        },
      },
    });
    expect(validationErrors(error)).toEqual({
      email: 'Enter a valid email address.',
      displayName: 'Name can be at most 100 characters.',
    });
  });

  it('still maps a PascalCase field name to the form control name', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: { Password: ['Enter your password.'] } },
    });
    expect(validationErrors(error)).toEqual({ password: 'Enter your password.' });
  });

  it('ignores other statuses, missing bodies and non-HTTP errors', () => {
    expect(validationErrors(new HttpErrorResponse({ status: 500 }))).toEqual({});
    expect(validationErrors(new HttpErrorResponse({ status: 400 }))).toEqual({});
    expect(validationErrors(new Error('x'))).toEqual({});
  });
});

describe('problemDetail', () => {
  const conflict = new HttpErrorResponse({
    status: 409,
    error: { status: 409, detail: 'An account with this name already exists.' },
  });

  it('returns the detail of a response with the expected status', () => {
    expect(problemDetail(conflict, 409)).toBe('An account with this name already exists.');
    expect(hasStatus(conflict, 409)).toBe(true);
  });

  it('returns null for another status, a blank detail or a non-HTTP error', () => {
    expect(problemDetail(conflict, 400)).toBeNull();
    expect(
      problemDetail(new HttpErrorResponse({ status: 409, error: { detail: ' ' } }), 409),
    ).toBeNull();
    expect(problemDetail(new HttpErrorResponse({ status: 409, error: 'text' }), 409)).toBeNull();
    expect(problemDetail(new Error('x'), 409)).toBeNull();
    expect(hasStatus(new Error('x'), 409)).toBe(false);
  });
});

describe('errorId', () => {
  it('returns the trace ID of a ProblemDetails response', () => {
    const error = new HttpErrorResponse({ status: 500, error: { traceId: '00-7f3a-91c2-00' } });
    expect(errorId(error)).toBe('00-7f3a-91c2-00');
  });

  it('returns null when there is no trace ID', () => {
    expect(errorId(new HttpErrorResponse({ status: 0 }))).toBeNull();
    expect(errorId(new HttpErrorResponse({ status: 500, error: { traceId: 42 } }))).toBeNull();
    expect(errorId(new Error('x'))).toBeNull();
  });
});
