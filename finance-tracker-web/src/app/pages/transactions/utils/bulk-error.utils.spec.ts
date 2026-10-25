import { HttpErrorResponse } from '@angular/common/http';
import { bulkErrorMessage } from './bulk-error.utils';

describe('bulkErrorMessage', () => {
  it('shows the API validation message', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        errors: { transactionIds: ["Transfers don't have a category. Unselect them first."] },
      },
    });
    expect(bulkErrorMessage(error)).toBe("Transfers don't have a category. Unselect them first.");
  });

  it('shows the detail of a 404, e.g. a deleted category', () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: { status: 404, detail: "This category doesn't exist." },
    });
    expect(bulkErrorMessage(error)).toBe("This category doesn't exist.");
  });

  it('explains a 404 without a detail, for a selection or one row', () => {
    const error = new HttpErrorResponse({ status: 404 });
    expect(bulkErrorMessage(error)).toBe(
      "One or more of the selected transactions don't exist. Refresh the list and try again.",
    );
    expect(bulkErrorMessage(error, true)).toBe(
      "This transaction doesn't exist. Refresh the list and try again.",
    );
  });

  it('falls back to the generic message', () => {
    expect(bulkErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe(
      'Something went wrong. Try again.',
    );
    expect(bulkErrorMessage(new Error('offline'))).toBe('Something went wrong. Try again.');
  });
});
