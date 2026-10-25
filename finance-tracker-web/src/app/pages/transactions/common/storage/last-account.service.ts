import { inject, Injectable } from '@angular/core';
import { UserStorageService } from '@common/auth/user-storage.service';

const LAST_ACCOUNT = 'lastAccountId';

/**
 * The account last used in Quick add (FEATURES.md F3: "Account defaults to the last account
 * used"), kept per user on this device and forgotten on logout.
 */
@Injectable({ providedIn: 'root' })
export class LastAccountService {
  private readonly storage = inject(UserStorageService);

  set(accountId: string): void {
    this.storage.set(LAST_ACCOUNT, accountId);
  }

  /** The remembered account if it is still active, otherwise the first active one. */
  pick(activeIds: readonly string[]): string {
    const last = this.storage.get(LAST_ACCOUNT);
    return last && activeIds.includes(last) ? last : (activeIds[0] ?? '');
  }
}
