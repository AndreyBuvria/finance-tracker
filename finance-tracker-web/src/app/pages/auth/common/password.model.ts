/** Password requirements (FEATURES.md F1): ≥ 8 characters, ≥ 1 letter, ≥ 1 number (0–9). */
export type PasswordRule = 'minLength' | 'letter' | 'number';

export type PasswordChecks = Readonly<Record<PasswordRule, boolean>>;
