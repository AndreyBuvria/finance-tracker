import { FormControl } from '@angular/forms';
import { notBlankValidator } from './not-blank.utils';

describe('notBlankValidator', () => {
  const validate = (value: string | null) => notBlankValidator(new FormControl(value));

  it.each(['', ' ', '   ', '\t\n', ' ', null])('treats %j as missing', (value) => {
    expect(validate(value)).toEqual({ required: true });
  });

  it('accepts text with surrounding spaces', () => {
    expect(validate(' Kasia ')).toBeNull();
  });
});
