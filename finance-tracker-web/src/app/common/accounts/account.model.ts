import { AccountTypeEnum } from './account-type.enum';

/*
 * PLAN.md §7 "Accounts contract (agreed)". Routes (under /api):
 * - GET /accounts?includeArchived=false → 200 AccountList
 * - POST /accounts AccountRequest → 201 Account; 400 validation; 409 duplicate active name
 * - PUT /accounts/{id} AccountRequest (full replace) → 200 Account; 409 duplicate; 404
 * - DELETE /accounts/{id} → 204 archives; 409 "You need at least one active account."; 404
 * - POST /accounts/{id}/restore → 204; 409 "An account with this name already exists. Rename it first."; 404
 */

/** Only PLN in the MVP. */
export type Currency = 'PLN';

export interface Account {
  id: string;
  name: string;
  type: AccountTypeEnum;
  currency: Currency;
  /** May be negative. */
  initialBalance: number;
  /** Computed by the API: initial balance + income − expenses ± transfers. */
  balance: number;
  isArchived: boolean;
}

export interface AccountList {
  /** Active accounts first, then archived ones (when requested), each by name. */
  items: Account[];
  /** Sum of the active accounts' balances, even when archived ones are listed. */
  netWorth: number;
}

/** Body of POST and PUT. PUT is a full replace, so always send the current currency and balance. */
export interface AccountRequest {
  name: string;
  type: AccountTypeEnum;
  currency: Currency;
  initialBalance: number;
}
