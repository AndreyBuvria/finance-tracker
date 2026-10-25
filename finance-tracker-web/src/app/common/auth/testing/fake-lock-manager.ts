/**
 * In-memory exclusive `LockManager` for tests (jsdom has no Web Locks). Grants requests one at a
 * time, in order, across every service that uses it, like the browser does across tabs.
 */
export class FakeLockManager {
  readonly requested: string[] = [];
  private tail: Promise<unknown> = Promise.resolve();

  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: (lock: { name: string; mode: 'exclusive' }) => Promise<unknown>,
  ): Promise<unknown> {
    this.requested.push(name);
    const signal = options.signal;
    // Like the browser: an abort rejects a waiting request right away and it is never granted.
    const aborted = new Promise<never>((_, reject) => {
      const rejectAborted = () =>
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      if (signal?.aborted) {
        rejectAborted();
      }
      signal?.addEventListener('abort', rejectAborted, { once: true });
    });
    let granted = false;
    const held = this.tail.then(() => {
      if (signal?.aborted) {
        return undefined;
      }
      granted = true;
      return callback({ name, mode: 'exclusive' });
    });
    this.tail = held.catch(() => undefined);
    return Promise.race([
      held,
      aborted.catch((error: unknown) => (granted ? held : Promise.reject(error))),
    ]);
  }
}

/** Puts `locks` on `navigator` until the returned cleanup runs. */
export function installLockManager(locks: unknown): () => void {
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, 'locks');
  };
}
