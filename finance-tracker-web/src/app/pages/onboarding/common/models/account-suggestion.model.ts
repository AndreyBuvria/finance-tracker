import { AccountTypeEnum } from '@common/accounts/account-type.enum';

/** Keys of the step 1 suggestions (one form group each). */
export type AccountSuggestionKey = 'card' | 'savings' | 'cash';

/** A pre-filled account suggestion of onboarding step 1 (FEATURES.md F1). */
export interface AccountSuggestion {
  readonly key: AccountSuggestionKey;
  /** Chip text and the default account name. */
  readonly label: string;
  readonly type: AccountTypeEnum;
  /** Rounded Material Symbols name, as on the account cards. */
  readonly icon: string;
}
