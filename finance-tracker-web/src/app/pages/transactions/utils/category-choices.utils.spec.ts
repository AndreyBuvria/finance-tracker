import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { CATEGORIES } from '../testing/transaction-fixtures.utils';
import { categoryChoices } from './category-choices.utils';

const names = (groups: ReturnType<typeof categoryChoices>) =>
  groups?.map((g) => [g.label, g.categories.map((c) => c.name)]);

describe('categoryChoices', () => {
  it('offers active expense categories for expenses', () => {
    expect(names(categoryChoices([TransactionTypeEnum.Expense], CATEGORIES))).toEqual([
      ['Expense', ['Groceries', 'Transport', 'Eating out']],
    ]);
  });

  it('offers income and expense (refund) categories for income', () => {
    expect(names(categoryChoices([TransactionTypeEnum.Income], CATEGORIES))).toEqual([
      ['Income', ['Salary', 'Other income']],
      ['Expense', ['Groceries', 'Transport', 'Eating out']],
    ]);
  });

  it('offers only expense categories for a mix of expenses and income', () => {
    expect(
      names(categoryChoices([TransactionTypeEnum.Income, TransactionTypeEnum.Expense], CATEGORIES)),
    ).toEqual([['Expense', ['Groceries', 'Transport', 'Eating out']]]);
  });

  it('offers nothing when a transfer is involved or nothing is selected', () => {
    expect(
      categoryChoices([TransactionTypeEnum.Expense, TransactionTypeEnum.Transfer], CATEGORIES),
    ).toBeNull();
    expect(categoryChoices([], CATEGORIES)).toBeNull();
  });

  it('leaves out empty groups', () => {
    expect(names(categoryChoices([TransactionTypeEnum.Income], CATEGORIES.slice(0, 1)))).toEqual([
      ['Expense', ['Groceries']],
    ]);
  });
});
