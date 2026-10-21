import { FormControl } from '@angular/forms';
import { checkPassword, passwordRulesValidator } from './password.utils';

describe('checkPassword', () => {
  it.each([
    ['', { minLength: false, letter: false, number: false }],
    ['abc', { minLength: false, letter: true, number: false }],
    ['12345678', { minLength: true, letter: false, number: true }],
    ['abcdefgh', { minLength: true, letter: true, number: false }],
    ['abcdefg1', { minLength: true, letter: true, number: true }],
    ['żółw2026', { minLength: true, letter: true, number: true }],
    ['!!!!!!!!', { minLength: true, letter: false, number: false }],
  ])('checks "%s"', (password, expected) => {
    expect(checkPassword(password)).toEqual(expected);
  });

  it('counts exactly 8 characters as long enough', () => {
    expect(checkPassword('a234567').minLength).toBe(false);
    expect(checkPassword('a2345678').minLength).toBe(true);
  });
});

describe('passwordRulesValidator', () => {
  const validate = (value: string) => passwordRulesValidator(new FormControl(value));

  it('passes a password that meets every requirement', () => {
    expect(validate('kasia2026')).toBeNull();
  });

  it('lists the unmet requirements', () => {
    expect(validate('kasia')).toEqual({ passwordRules: { unmet: ['minLength', 'number'] } });
    expect(validate('20261019')).toEqual({ passwordRules: { unmet: ['letter'] } });
  });

  it('leaves an empty value to Validators.required', () => {
    expect(validate('')).toBeNull();
  });
});
