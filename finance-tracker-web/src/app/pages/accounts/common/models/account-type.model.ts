import { AccountTypeEnum } from '@common/accounts/account-type.enum';

/** How an account type is shown: label and icon. */
export interface AccountTypeOption {
  readonly type: AccountTypeEnum;
  readonly label: string;
  /** Rounded Material Symbols name (DESIGN.md: card / piggy bank / wallet). */
  readonly icon: string;
}
