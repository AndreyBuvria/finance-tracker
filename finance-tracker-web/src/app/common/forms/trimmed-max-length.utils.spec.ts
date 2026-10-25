import { FormControl } from '@angular/forms';
import { trimmedMaxLengthValidator } from './trimmed-max-length.utils';

describe('trimmedMaxLengthValidator', () => {
  const validate = (value: string | null) => trimmedMaxLengthValidator(5)(new FormControl(value));

  it('accepts values up to the limit, ignoring surrounding whitespace', () => {
    expect(validate('')).toBeNull();
    expect(validate(null)).toBeNull();
    expect(validate('abcde')).toBeNull();
    expect(validate('  abcde  ')).toBeNull();
  });

  it('reports a maxlength error past the limit', () => {
    expect(validate('abcdef')).toEqual({ maxlength: { requiredLength: 5, actualLength: 6 } });
    expect(validate(' ab cdef ')).toEqual({ maxlength: { requiredLength: 5, actualLength: 7 } });
  });
});
