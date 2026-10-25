import { inject, Injectable, signal } from '@angular/core';
import { UserStorageService } from '../auth/user-storage.service';

/** `UserStorageService` key; stored only while shortcuts are off. */
export const SHORTCUTS_DISABLED_KEY = 'shortcutsDisabled';

/**
 * Whether single-key shortcuts (e.g. `N` for the page's "Add") are on (PLAN.md §8 Settings,
 * WCAG 2.1.4 "Character Key Shortcuts"). On by default; the choice is kept per user on this device
 * and, unlike session preferences such as the last account, across logouts (PLAN.md §8).
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsPreferenceService {
  private readonly userStorage = inject(UserStorageService);
  private readonly state = signal(this.read());

  readonly enabled = this.state.asReadonly();

  /**
   * Reads the signed-in user's choice again. Call it when the signed-in app starts (the user is
   * known only once the session is restored), so a previous user's choice never carries over.
   */
  load(): void {
    this.state.set(this.read());
  }

  setEnabled(enabled: boolean): void {
    if (enabled) {
      this.userStorage.remove(SHORTCUTS_DISABLED_KEY, 'device');
    } else {
      this.userStorage.set(SHORTCUTS_DISABLED_KEY, 'true', 'device');
    }
    this.state.set(enabled);
  }

  private read(): boolean {
    return this.userStorage.get(SHORTCUTS_DISABLED_KEY, 'device') !== 'true';
  }
}
