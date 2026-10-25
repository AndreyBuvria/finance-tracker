import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { applyServerErrors, QUICK_ADD_SERVER_FIELDS } from './server-errors.utils';

function controls() {
  return Object.fromEntries(
    QUICK_ADD_SERVER_FIELDS.map((field) => [field, new FormControl('')]),
  ) as Record<(typeof QUICK_ADD_SERVER_FIELDS)[number], FormControl<string | null>>;
}

const validation = (errors: Record<string, string[]>) =>
  new HttpErrorResponse({ status: 400, error: { errors } });

describe('applyServerErrors', () => {
  it('puts each message on its control', () => {
    const c = controls();
    const result = applyServerErrors(
      c,
      validation({
        amount: ['Enter a smaller amount.'],
        toAccountId: ['Choose two different accounts.'],
      }),
    );
    expect(result).toBeNull();
    expect(c.amount.errors).toEqual({ server: 'Enter a smaller amount.' });
    expect(c.amount.touched).toBe(true);
    expect(c.toAccountId.errors).toEqual({ server: 'Choose two different accounts.' });
    expect(c.merchant.errors).toBeNull();
  });

  it('returns a message without a field for the whole form', () => {
    expect(
      applyServerErrors(controls(), validation({ type: ['Choose a transaction type.'] })),
    ).toEqual({ message: 'Choose a transaction type.' });
    expect(
      applyServerErrors(
        controls(),
        new HttpErrorResponse({ status: 404, error: { detail: "This account doesn't exist." } }),
      ),
    ).toEqual({ message: "This account doesn't exist." });
  });

  it('falls back to the generic error', () => {
    expect(applyServerErrors(controls(), new HttpErrorResponse({ status: 500 }))).toBe('generic');
  });
});
