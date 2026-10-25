/**
 * The `sub` claim (user ID) of a JWT, or null when the token can't be read. Only for client-side
 * bookkeeping such as per-user preferences: the token is not verified here (the API does that).
 */
export function jwtSubject(token: string | null): string | null {
  const payload = token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    const sub =
      claims !== null && typeof claims === 'object' ? (claims as { sub?: unknown }).sub : null;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}
