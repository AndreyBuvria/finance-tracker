import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { AccountSuggestion } from '../models/account-suggestion.model';

/** Step 1 toggle chips, in display order (FEATURES.md F1, DESIGN.md "Onboarding"). */
export const ACCOUNT_SUGGESTIONS: readonly AccountSuggestion[] = [
  {
    key: 'card',
    label: $localize`:@@onboarding.accounts.suggestion.card:Main card`,
    type: AccountTypeEnum.Card,
    icon: 'credit_card',
  },
  {
    key: 'savings',
    label: $localize`:@@onboarding.accounts.suggestion.savings:Savings`,
    type: AccountTypeEnum.Savings,
    icon: 'savings',
  },
  {
    key: 'cash',
    label: $localize`:@@onboarding.accounts.suggestion.cash:Cash`,
    type: AccountTypeEnum.Cash,
    icon: 'wallet',
  },
];
