import { FormControl } from '@angular/forms';
import { amountInputValidator, formatAmountInput, parseAmountInput } from './amount-input.utils';

describe('parseAmountInput', () => {
  it.each([
    ['0', 0],
    ['150', 150],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['1 234,56', 1234.56],
    ['1\u00a0234,5', 1234.5],
    [' 12,30 ', 12.3],
    [',5', 0.5],
    ['12,', 12],
    ['-50', -50],
    ['\u221212,5', -12.5],
    ['-0', 0],
  ])('reads "%s" as %d', (text, value) => {
    expect(parseAmountInput(text)).toEqual({ kind: 'ok', value });
  });

  it('treats a blank field as empty', () => {
    expect(parseAmountInput('')).toEqual({ kind: 'empty' });
    expect(parseAmountInput('   ')).toEqual({ kind: 'empty' });
  });

  it.each(['abc', '12a', '1,2,3', '1.234,56', '-', ',', '+5', '--5', '5-'])(
    'rejects "%s"',
    (text) => {
      expect(parseAmountInput(text)).toEqual({ kind: 'invalid' });
    },
  );

  it('rejects more than two decimals', () => {
    expect(parseAmountInput('1,234')).toEqual({ kind: 'tooManyDecimals' });
  });

  it('accepts up to 13 integer digits and keeps the cents exact', () => {
    expect(parseAmountInput('9999999999999,99')).toEqual({ kind: 'ok', value: 9999999999999.99 });
    expect(parseAmountInput('-9 999 999 999 999,01')).toEqual({
      kind: 'ok',
      value: -9999999999999.01,
    });
    expect((9999999999999.99).toFixed(2)).toBe('9999999999999.99');
    expect(parseAmountInput('0001')).toEqual({ kind: 'ok', value: 1 });
  });

  it('rejects more than 13 integer digits', () => {
    expect(parseAmountInput('10000000000000')).toEqual({ kind: 'tooLarge' });
    expect(parseAmountInput('-10000000000000,5')).toEqual({ kind: 'tooLarge' });
  });
});

describe('amountInputValidator', () => {
  const errorsFor = (value: string) => amountInputValidator(new FormControl(value));

  it('maps each problem to its error key', () => {
    expect(errorsFor('')).toBeNull();
    expect(errorsFor('12,50')).toBeNull();
    expect(errorsFor('x')).toEqual({ amountInvalid: true });
    expect(errorsFor('1,001')).toEqual({ amountDecimals: true });
    expect(errorsFor('10000000000000')).toEqual({ amountTooLarge: true });
  });
});

describe('formatAmountInput', () => {
  it('formats with a decimal comma and no grouping', () => {
    expect(formatAmountInput(1234.5)).toBe('1234,50');
    expect(formatAmountInput(0)).toBe('0,00');
    expect(formatAmountInput(-3)).toBe('-3,00');
  });
});
