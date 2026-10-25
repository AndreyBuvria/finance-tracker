import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { AccountTypeOption } from '../models/account-type.model';

/** Account types in display order (FEATURES.md F2: Card / Savings / Cash). */
export const ACCOUNT_TYPE_OPTIONS: readonly AccountTypeOption[] = [
  { type: AccountTypeEnum.Card, label: $localize`:@@accounts.type.card:Card`, icon: 'credit_card' },
  {
    type: AccountTypeEnum.Savings,
    label: $localize`:@@accounts.type.savings:Savings`,
    icon: 'savings',
  },
  { type: AccountTypeEnum.Cash, label: $localize`:@@accounts.type.cash:Cash`, icon: 'wallet' },
];
