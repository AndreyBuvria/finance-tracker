import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { ACCOUNT_TYPE_OPTIONS } from '../common/constants/account-type.constants';
import { AccountTypeOption } from '../common/models/account-type.model';

/** Label and icon of a type; an unknown value falls back to its name and a generic wallet. */
export function accountTypeOption(type: AccountTypeEnum): AccountTypeOption {
  return (
    ACCOUNT_TYPE_OPTIONS.find((option) => option.type === type) ?? {
      type,
      label: type,
      icon: 'account_balance_wallet',
    }
  );
}
