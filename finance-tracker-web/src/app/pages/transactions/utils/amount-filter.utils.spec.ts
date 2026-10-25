import { FormControl, FormGroup } from '@angular/forms';
import {
  amountFilterValue,
  amountRangeValidator,
  nonNegativeAmountValidator,
} from './amount-filter.utils';

describe('amount filter utils', () => {
  it('reads amounts typed with a comma or a dot', () => {
    expect(amountFilterValue('12,50')).toBe(12.5);
    expect(amountFilterValue('1 000.5')).toBe(1000.5);
    expect(amountFilterValue('')).toBeNull();
    expect(amountFilterValue('abc')).toBeNull();
  });

  it('rejects negative amounts', () => {
    expect(nonNegativeAmountValidator(new FormControl('-5'))).toEqual({ amountNegative: true });
    expect(nonNegativeAmountValidator(new FormControl('0'))).toBeNull();
    expect(nonNegativeAmountValidator(new FormControl(''))).toBeNull();
  });

  it('rejects a maximum below the minimum', () => {
    const range = (min: string, max: string) =>
      amountRangeValidator(new FormGroup({ min: new FormControl(min), max: new FormControl(max) }));
    expect(range('50', '10')).toEqual({ amountRangeReversed: true });
    expect(range('10', '10')).toBeNull();
    expect(range('10', '')).toBeNull();
    expect(range('', '5')).toBeNull();
  });
});
