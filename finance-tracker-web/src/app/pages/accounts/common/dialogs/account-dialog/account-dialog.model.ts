import { Account } from '@common/accounts/account.model';

/** Data for the account dialog: an account to edit, or nothing to add a new one. */
export interface AccountDialogData {
  readonly account?: Account;
}

/**
 * What the dialog closes with: the saved account, or `notFound` when the edited account no longer
 * exists (404; the page reports it and reloads). Closing without saving gives `undefined`.
 */
export type AccountDialogResult =
  { readonly status: 'saved'; readonly account: Account } | { readonly status: 'notFound' };
