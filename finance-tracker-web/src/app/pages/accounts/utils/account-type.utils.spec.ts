import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { accountTypeOption } from './account-type.utils';

describe('accountTypeOption', () => {
  it('gives each type its label and icon (card / piggy bank / wallet)', () => {
    expect(accountTypeOption(AccountTypeEnum.Card)).toMatchObject({
      label: 'Card',
      icon: 'credit_card',
    });
    expect(accountTypeOption(AccountTypeEnum.Savings)).toMatchObject({
      label: 'Savings',
      icon: 'savings',
    });
    expect(accountTypeOption(AccountTypeEnum.Cash)).toMatchObject({
      label: 'Cash',
      icon: 'wallet',
    });
  });

  it('falls back for an unknown type', () => {
    expect(accountTypeOption('Crypto' as AccountTypeEnum)).toMatchObject({
      label: 'Crypto',
      icon: 'account_balance_wallet',
    });
  });
});
