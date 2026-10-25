import { DOCUMENT, inject, Injectable } from '@angular/core';
import { defer, finalize, Observable, Subscription } from 'rxjs';

/** Web Locks name shared by every tab of the app on this origin. */
export const SESSION_LOCK_NAME = 'ft.auth.session';

/**
 * How long to wait for the lock before running without it. Longer than the auth request timeout
 * (`AUTH_REQUEST_TIMEOUT_MS`), so a healthy holder always finishes first.
 */
export const SESSION_LOCK_WAIT_MS = 20_000;

/** Abort reason that tells a wait timeout apart from the caller unsubscribing. */
const WAIT_TIMED_OUT = 'session-lock-wait-timed-out';

/**
 * Runs work on the stored refresh token (refresh, logout) in one tab at a time, using the Web Locks
 * API, so two tabs never send the same refresh token: the second tab waits, then reads the token the
 * first tab just stored. Callers must read the refresh token inside `work`, save the result before
 * it completes, and bound their requests with a timeout so the lock is never held forever.
 *
 * Without Web Locks (older browsers, insecure origins), if the lock can't be taken, or after
 * waiting `SESSION_LOCK_WAIT_MS`, the work runs without the lock; the API's ~10 s reuse grace
 * window keeps concurrent refreshes from logging the user out. Not reentrant: never call `run`
 * from inside `work`.
 */
@Injectable({ providedIn: 'root' })
export class SessionLockService {
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;

  run<T>(work: () => Observable<T>): Observable<T> {
    // `locks` is missing in older browsers and on insecure origins, even though the DOM types say
    // otherwise.
    const locks = this.navigator?.locks as LockManager | undefined;
    if (!locks) {
      return defer(work);
    }
    return new Observable<T>((subscriber) => {
      const abort = new AbortController();
      const waitTimer = setTimeout(() => abort.abort(WAIT_TIMED_OUT), SESSION_LOCK_WAIT_MS);
      let inner: Subscription | undefined;
      const start = (release?: () => void) => {
        clearTimeout(waitTimer);
        // `defer` turns a synchronous throw in `work` into an error, so the lock is still released.
        inner = defer(work)
          .pipe(finalize(() => release?.()))
          .subscribe(subscriber);
      };
      locks
        .request(
          SESSION_LOCK_NAME,
          { signal: abort.signal },
          () =>
            new Promise<void>((release) => {
              if (subscriber.closed) {
                release();
              } else {
                start(release);
              }
            }),
        )
        .catch(() => {
          // Every failure here happens before the lock is granted. If the caller unsubscribed while
          // waiting, there is nothing to do; otherwise (wait timed out, lock unavailable) run
          // without the lock rather than fail the request.
          const callerLeft = abort.signal.aborted && abort.signal.reason !== WAIT_TIMED_OUT;
          if (!inner && !callerLeft) {
            start();
          }
        });
      return () => {
        clearTimeout(waitTimer);
        abort.abort();
        inner?.unsubscribe();
      };
    });
  }
}
