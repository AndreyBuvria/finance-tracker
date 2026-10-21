import { safeReturnUrl } from './return-url.utils';

describe('safeReturnUrl', () => {
  it('keeps in-app paths with their query', () => {
    expect(safeReturnUrl('/transactions?month=2026-10')).toBe('/transactions?month=2026-10');
  });

  it.each([
    undefined,
    null,
    '',
    'transactions',
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '/auth/login',
    '/auth/register',
  ])('falls back to the dashboard for %s', (value) => {
    expect(safeReturnUrl(value)).toBe('/dashboard');
  });
});
