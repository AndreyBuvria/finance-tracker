import { FormControl } from '@angular/forms';
import { checkPassword, passwordLetterAndNumberValidator } from './password.utils';

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

  it('counts only ASCII digits 0–9 as a number, like the API', () => {
    // Arabic-Indic three, Devanagari five, fullwidth seven: all Unicode decimal digits.
    expect(checkPassword('hasło٣५７').number).toBe(false);
    expect(checkPassword('hasło0').number).toBe(true);
    expect(checkPassword('hasło9').number).toBe(true);
  });
});

describe('passwordLetterAndNumberValidator', () => {
  const validate = (value: string) => passwordLetterAndNumberValidator(new FormControl(value));

  it('passes a password with a letter and an ASCII digit', () => {
    expect(validate('kasia2026')).toBeNull();
    // Length is not this validator's job.
    expect(validate('k1')).toBeNull();
  });

  it('fails without a letter or without an ASCII digit', () => {
    expect(validate('kasiakasia')).toEqual({ passwordLetterAndNumber: true });
    expect(validate('20261019')).toEqual({ passwordLetterAndNumber: true });
    expect(validate('kasia٣٣٣')).toEqual({ passwordLetterAndNumber: true });
  });

  it('leaves an empty value to Validators.required', () => {
    expect(validate('')).toBeNull();
  });
});
