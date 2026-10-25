import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';

/** A category for tests; a default (expense) unless overridden. */
export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c',
    name: 'Category',
    type: CategoryTypeEnum.Expense,
    icon: 'category',
    color: '#546e7a',
    systemKey: null,
    isArchived: false,
    isProtected: false,
    transactionCount: 0,
    budgetCount: 0,
    ...overrides,
  };
}

/** A small mixed list: defaults, the fallbacks, custom ones and a hidden default. */
export const CATEGORIES: readonly Category[] = [
  category({
    id: 'eating',
    name: 'Eating out',
    systemKey: 'eating_out',
    icon: 'restaurant',
    color: '#ef6c00',
    transactionCount: 40,
    budgetCount: 1,
  }),
  category({ id: 'other', name: 'Other', systemKey: 'other', isProtected: true }),
  category({
    id: 'coffee',
    name: 'Coffee',
    icon: 'local_cafe',
    color: '#6d4c41',
    transactionCount: 34,
    budgetCount: 1,
  }),
  category({ id: 'dog', name: 'Dog', icon: 'pets', color: '#2e7d32' }),
  category({
    id: 'salary',
    name: 'Salary',
    type: CategoryTypeEnum.Income,
    systemKey: 'salary',
    icon: 'payments',
    color: '#00838f',
    transactionCount: 6,
  }),
  category({
    id: 'other-income',
    name: 'Other income',
    type: CategoryTypeEnum.Income,
    systemKey: 'other_income',
    icon: 'savings',
    color: '#c0ca33',
    isProtected: true,
  }),
  category({
    id: 'health',
    name: 'Health',
    systemKey: 'health',
    icon: 'medical_services',
    color: '#c62828',
    isArchived: true,
  }),
];
