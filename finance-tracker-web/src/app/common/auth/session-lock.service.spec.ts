import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import {
  SESSION_LOCK_NAME,
  SESSION_LOCK_WAIT_MS,
  SessionLockService,
} from './session-lock.service';
import { FakeLockManager, installLockManager } from './testing/fake-lock-manager';

/** Lets pending promise callbacks (lock grants) run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('SessionLockService', () => {
  let uninstall: (() => void) | undefined;

  afterEach(() => {
    uninstall?.();
    uninstall = undefined;
  });

  function create(locks?: unknown): SessionLockService {
    if (locks) {
      uninstall = installLockManager(locks);
    }
    return TestBed.inject(SessionLockService);
  }

  it('runs the work directly when Web Locks are not available', async () => {
    const lock = create();
    const work = vi.fn(() => of('done'));
    const result = lock.run(work);
    expect(work).not.toHaveBeenCalled();
    expect(await firstValueFrom(result)).toBe('done');
    expect(work).toHaveBeenCalledTimes(1);
  });

  describe('with Web Locks', () => {
    let locks: FakeLockManager;
    let lock: SessionLockService;

    beforeEach(() => {
      locks = new FakeLockManager();
      lock = create(locks);
    });

    it('runs the work while holding the shared lock', async () => {
      expect(await firstValueFrom(lock.run(() => of(1)))).toBe(1);
      expect(locks.requested).toEqual([SESSION_LOCK_NAME]);
    });

    it('starts the next work only after the previous one has finished', async () => {
      const first$ = new Subject<string>();
      const secondWork = vi.fn(() => of('second'));
      const first = firstValueFrom(lock.run(() => first$));
      const second = firstValueFrom(lock.run(secondWork));
      await settle();
      expect(secondWork).not.toHaveBeenCalled();

      first$.next('first');
      first$.complete();
      expect(await first).toBe('first');
      expect(await second).toBe('second');
      expect(secondWork).toHaveBeenCalledTimes(1);
    });

    it('releases the lock when the work fails', async () => {
      const failed = firstValueFrom(lock.run(() => throwError(() => new Error('boom'))));
      await expect(failed).rejects.toThrow('boom');
      expect(await firstValueFrom(lock.run(() => of('next')))).toBe('next');
    });

    it('fails and releases the lock when the work throws synchronously', async () => {
      const failed = firstValueFrom(
        lock.run((): Observable<never> => {
          throw new Error('sync boom');
        }),
      );
      await expect(failed).rejects.toThrow('sync boom');
      expect(await firstValueFrom(lock.run(() => of('next')))).toBe('next');
    });

    it('runs without the lock after waiting too long for it', async () => {
      vi.useFakeTimers();
      try {
        lock.run(() => new Observable<never>()).subscribe(); // a stuck holder
        await vi.advanceTimersByTimeAsync(0);
        const work = vi.fn(() => of('unlocked'));
        const result = firstValueFrom(lock.run(work));
        await vi.advanceTimersByTimeAsync(SESSION_LOCK_WAIT_MS - 1);
        expect(work).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toBe('unlocked');
      } finally {
        vi.useRealTimers();
      }
    });

    it('releases the lock when the caller unsubscribes during the work', async () => {
      const subscription = lock.run(() => new Observable<never>()).subscribe();
      await settle();
      subscription.unsubscribe();
      expect(await firstValueFrom(lock.run(() => of('next')))).toBe('next');
    });

    it('never runs the work when the caller unsubscribes while waiting', async () => {
      const first$ = new Subject<string>();
      const work = vi.fn(() => of('late'));
      const first = firstValueFrom(lock.run(() => first$));
      lock.run(work).subscribe().unsubscribe();
      await settle();
      first$.next('first');
      first$.complete();
      await first;
      await settle();
      expect(work).not.toHaveBeenCalled();
    });
  });

  it('falls back to running the work when the lock cannot be taken', async () => {
    const lock = create({
      request: () => Promise.reject(new DOMException('Blocked', 'SecurityError')),
    });
    expect(await firstValueFrom(lock.run(() => of('done')))).toBe('done');
  });
});
