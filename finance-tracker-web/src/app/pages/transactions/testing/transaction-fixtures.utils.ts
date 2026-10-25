import { Category } from '@common/categories/category.model';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Transaction, TransactionPage } from '@common/transactions/transaction.model';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';

/** Test data for the Transactions page (DESIGN.md sample data). */

export const IDS = {
  mbank: 'aaaaaaaa-0000-4000-8000-000000000001',
  savings: 'aaaaaaaa-0000-4000-8000-000000000002',
  groceries: 'cccccccc-0000-4000-8000-000000000001',
  transport: 'cccccccc-0000-4000-8000-000000000002',
  eatingOut: 'cccccccc-0000-4000-8000-000000000003',
  oldCoffee: 'cccccccc-0000-4000-8000-000000000004',
  salary: 'cccccccc-0000-4000-8000-000000000005',
  otherIncome: 'cccccccc-0000-4000-8000-000000000006',
} as const;

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: IDS.groceries,
    name: 'Groceries',
    type: CategoryTypeEnum.Expense,
    icon: 'shopping_cart',
    color: '#2e7d32',
    systemKey: 'groceries',
    isArchived: false,
    isProtected: false,
    transactionCount: 0,
    budgetCount: 0,
    ...overrides,
  };
}

export const CATEGORIES: Category[] = [
  category(),
  category({ id: IDS.transport, name: 'Transport', icon: 'directions_bus', color: '#1565c0' }),
  category({ id: IDS.eatingOut, name: 'Eating out', icon: 'restaurant', color: '#ef6c00' }),
  category({ id: IDS.oldCoffee, name: 'Coffee', icon: 'local_cafe', isArchived: true }),
  category({
    id: IDS.salary,
    name: 'Salary',
    type: CategoryTypeEnum.Income,
    icon: 'payments',
    color: '#00838f',
  }),
  category({
    id: IDS.otherIncome,
    name: 'Other income',
    type: CategoryTypeEnum.Income,
    icon: 'savings',
    color: '#c0ca33',
  }),
];

const MBANK = { id: IDS.mbank, name: 'mBank card', isArchived: false };
const SAVINGS = { id: IDS.savings, name: 'Savings', isArchived: false };

export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  const groceries = CATEGORIES[0];
  return {
    id: 't1',
    type: TransactionTypeEnum.Expense,
    amount: 18.47,
    date: '2026-10-19',
    merchant: 'Żabka',
    note: null,
    source: TransactionSourceEnum.Manual,
    account: MBANK,
    category: {
      id: groceries.id,
      name: groceries.name,
      type: groceries.type,
      icon: groceries.icon,
      color: groceries.color,
      systemKey: groceries.systemKey,
      isArchived: false,
    },
    transfer: null,
    import: null,
    needsCategory: false,
    ...overrides,
  };
}

export function transfer(overrides: Partial<Transaction> = {}): Transaction {
  return transaction({
    id: 'tr1',
    type: TransactionTypeEnum.Transfer,
    amount: 1000,
    merchant: null,
    category: null,
    transfer: { transferPairId: 'pair1', fromAccount: MBANK, toAccount: SAVINGS },
    ...overrides,
  });
}

export function income(overrides: Partial<Transaction> = {}): Transaction {
  return transaction({
    id: 'in1',
    type: TransactionTypeEnum.Income,
    amount: 7500,
    merchant: 'Salary',
    category: {
      id: IDS.salary,
      name: 'Salary',
      type: CategoryTypeEnum.Income,
      icon: 'payments',
      color: '#00838f',
      systemKey: 'salary',
      isArchived: false,
    },
    ...overrides,
  });
}

export function page(
  items: Transaction[],
  overrides: Partial<TransactionPage> = {},
): TransactionPage {
  return {
    items,
    page: 1,
    pageSize: 50,
    totalCount: items.length,
    totalPages: items.length ? 1 : 0,
    totals: { income: 0, expenses: 0, net: 0 },
    ...overrides,
  };
}
