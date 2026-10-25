import '@common/locale/locale.utils';
import { income, transaction, transfer } from '../testing/transaction-fixtures.utils';
import { addedMessage } from './added-message.utils';

const visible = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('addedMessage', () => {
  it('names the type, signed amount and category', () => {
    expect(
      visible(
        addedMessage(
          transaction({
            amount: 24,
            category: { ...transaction().category!, name: 'Eating out' },
          }),
        ),
      ),
    ).toBe('Expense added · −24,00 zł Eating out');
    expect(visible(addedMessage(income()))).toBe('Income added · +7 500,00 zł Salary');
  });

  it('names the accounts of a transfer', () => {
    expect(visible(addedMessage(transfer()))).toBe(
      'Transfer added · 1 000,00 zł mBank card → Savings',
    );
  });

  it('ends without a space when there is no category', () => {
    expect(visible(addedMessage(transaction({ amount: 5, category: null })))).toBe(
      'Expense added · \u22125,00 zł',
    );
  });
});
