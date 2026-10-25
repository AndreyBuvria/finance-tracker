import { FormControl } from '@angular/forms';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';
import {
  budgetCategoryRows,
  limitFromInput,
  nonNegativeAmountValidator,
} from './budget-limit.utils';

const category = (systemKey: string | null, overrides: Partial<Category> = {}): Category => ({
  id: `id-${systemKey}`,
  name: systemKey ?? 'Dog',
  type: CategoryTypeEnum.Expense,
  icon: 'category',
  color: '#546e7a',
  systemKey,
  isArchived: false,
  isProtected: false,
  transactionCount: 0,
  budgetCount: 0,
  ...overrides,
});

describe('budgetCategoryRows', () => {
  it('picks the five defaults by systemKey, in display order', () => {
    const rows = budgetCategoryRows([
      category('entertainment'),
      category('housing'),
      category(null),
      category('shopping'),
      category('transport'),
      category('groceries'),
      category('eating_out'),
    ]);
    expect(rows.map((row) => row.key)).toEqual([
      'groceries',
      'eating_out',
      'transport',
      'shopping',
      'entertainment',
    ]);
    expect(rows[0].category.id).toBe('id-groceries');
  });

  it('leaves out hidden or missing defaults', () => {
    const rows = budgetCategoryRows([
      category('groceries', { isArchived: true }),
      category('transport'),
    ]);
    expect(rows.map((row) => row.key)).toEqual(['transport']);
  });
});

describe('nonNegativeAmountValidator', () => {
  const check = (value: string) => nonNegativeAmountValidator(new FormControl(value));

  it('rejects a negative amount only', () => {
    expect(check('-5')).toEqual({ amountNegative: true });
    expect(check('−12,50')).toEqual({ amountNegative: true });
    expect(check('0')).toBeNull();
    expect(check('600')).toBeNull();
    expect(check('')).toBeNull();
    expect(check('abc')).toBeNull();
  });
});

describe('limitFromInput', () => {
  it('reads Polish and English amounts', () => {
    expect(limitFromInput('1 200,50')).toBe(1200.5);
    expect(limitFromInput('600')).toBe(600);
  });

  it('treats a blank field and 0 as no budget', () => {
    expect(limitFromInput('')).toBeNull();
    expect(limitFromInput('  ')).toBeNull();
    expect(limitFromInput('0,00')).toBeNull();
  });
});
