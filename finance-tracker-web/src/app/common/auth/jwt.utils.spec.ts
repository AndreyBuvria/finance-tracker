import { jwtSubject } from './jwt.utils';

const encode = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('jwtSubject', () => {
  it('reads the sub claim of a JWT (base64url, unpadded)', () => {
    const token = `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', exp: 1 })}.signature`;
    expect(jwtSubject(token)).toBe('user-1');
  });

  it('returns null for a missing, malformed or sub-less token', () => {
    expect(jwtSubject(null)).toBeNull();
    expect(jwtSubject('not-a-jwt')).toBeNull();
    expect(jwtSubject('a.%%%.c')).toBeNull();
    expect(jwtSubject(`x.${encode({ exp: 1 })}.y`)).toBeNull();
  });
});
