import { HttpErrorResponse } from '@angular/common/http';
import { validationErrors } from './problem-details.utils';

describe('validationErrors', () => {
  it('returns the first message per field with camelCase field names', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { Email: ['Email is invalid.', 'Second'], DisplayName: ['Too long.'] },
      },
    });
    expect(validationErrors(error)).toEqual({
      email: 'Email is invalid.',
      displayName: 'Too long.',
    });
  });

  it('ignores other statuses, missing bodies and non-HTTP errors', () => {
    expect(validationErrors(new HttpErrorResponse({ status: 500 }))).toEqual({});
    expect(validationErrors(new HttpErrorResponse({ status: 400 }))).toEqual({});
    expect(validationErrors(new Error('x'))).toEqual({});
  });
});
