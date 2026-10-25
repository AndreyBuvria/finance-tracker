import { DOCUMENT, inject, Injectable } from '@angular/core';
import { TokenStorageService } from './token-storage.service';

/**
 * How long a per-user value lives on this device:
 * - `session` (default): until logout or the end of the session (e.g. the last account used);
 * - `device`: kept across logouts, for settings the user chose on purpose (e.g. turning off
 *   single-key shortcuts, PLAN.md §8).
 */
export type UserStorageLifetime = 'session' | 'device';

const PREFIXES: Record<UserStorageLifetime, string> = {
  session: 'ft.user.',
  device: 'ft.userDevice.',
};

/**
 * Small per-user preferences on this device, stored under the signed-in user's ID. Session values
 * are removed on logout; device values stay (still per user). Storage may be blocked: then nothing
 * is remembered and reads return null.
 */
@Injectable({ providedIn: 'root' })
export class UserStorageService {
  private readonly tokens = inject(TokenStorageService);
  private readonly window = inject(DOCUMENT).defaultView;

  get(name: string, lifetime: UserStorageLifetime = 'session'): string | null {
    const key = this.key(name, lifetime);
    try {
      return key ? (this.window?.localStorage.getItem(key) ?? null) : null;
    } catch {
      return null;
    }
  }

  set(name: string, value: string, lifetime: UserStorageLifetime = 'session'): void {
    const key = this.key(name, lifetime);
    try {
      if (key) {
        this.window?.localStorage.setItem(key, value);
      }
    } catch {
      // Blocked or full: not remembered.
    }
  }

  remove(name: string, lifetime: UserStorageLifetime = 'session'): void {
    const key = this.key(name, lifetime);
    try {
      if (key) {
        this.window?.localStorage.removeItem(key);
      }
    } catch {
      // Blocked: nothing was stored.
    }
  }

  /** Removes every user's session values from this device (on logout); device values stay. */
  clearAll(): void {
    try {
      const storage = this.window?.localStorage;
      if (!storage) {
        return;
      }
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (key): key is string => !!key?.startsWith(PREFIXES.session),
      );
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Blocked: nothing was stored.
    }
  }

  private key(name: string, lifetime: UserStorageLifetime): string | null {
    const userId = this.tokens.getUserId();
    return userId ? `${PREFIXES[lifetime]}${userId}.${name}` : null;
  }
}
