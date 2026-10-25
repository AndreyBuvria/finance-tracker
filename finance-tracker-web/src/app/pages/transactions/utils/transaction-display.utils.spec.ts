import { income, transaction, transfer } from '../testing/transaction-fixtures.utils';
import {
  groupByDay,
  moneyKind,
  parseSort,
  selectionTotal,
  signedTotal,
  toSort,
  transactionTitle,
  transferLabel,
} from './transaction-display.utils';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';

describe('transaction display utils', () => {
  it('maps the type to the money format', () => {
    expect(moneyKind(TransactionTypeEnum.Expense)).toBe('expense');
    expect(moneyKind(TransactionTypeEnum.Income)).toBe('income');
    expect(moneyKind(TransactionTypeEnum.Transfer)).toBe('transfer');
  });

  it('groups consecutive rows by day with the net amount, ignoring transfers', () => {
    const groups = groupByDay([
      transaction({ id: 'a', amount: 18.47 }),
      transaction({ id: 'b', amount: 67.93 }),
      transfer({ id: 'c' }),
      transaction({ id: 'd', date: '2026-10-18', amount: 24 }),
      income({ id: 'e', date: '2026-10-18', amount: 30.1 }),
    ]);
    expect(groups.map((g) => [g.date, g.items.map((t) => t.id), g.total])).toEqual([
      ['2026-10-19', ['a', 'b', 'c'], -86.4],
      ['2026-10-18', ['d', 'e'], 6.1],
    ]);
  });

  it('shows a net amount with its sign', () => {
    expect(signedTotal(-86.4)).toEqual({ amount: 86.4, kind: 'expense' });
    expect(signedTotal(12)).toEqual({ amount: 12, kind: 'income' });
    expect(signedTotal(0.001)).toEqual({ amount: 0, kind: 'plain' });
  });

  it('totals a selection for the delete confirmation', () => {
    expect(
      selectionTotal([
        transaction({ amount: 100 }),
        transaction({ amount: 112 }),
        transfer({ amount: 1000 }),
      ]),
    ).toEqual({ amount: 212, kind: 'expense' });
    expect(selectionTotal([income({ amount: 50 }), transaction({ amount: 20 })])).toEqual({
      amount: 30,
      kind: 'income',
    });
    expect(selectionTotal([transfer({ amount: 1000 }), transfer({ amount: 0.5 })])).toEqual({
      amount: 1000.5,
      kind: 'transfer',
    });
  });

  it('titles a row by merchant, note, category or transfer accounts', () => {
    expect(transactionTitle(transaction())).toBe('Żabka');
    expect(transactionTitle(transaction({ merchant: null, note: 'Lunch' }))).toBe('Lunch');
    expect(transactionTitle(transaction({ merchant: null }))).toBe('Groceries');
    expect(transactionTitle(transfer())).toBe('mBank card → Savings');
    expect(transferLabel(transaction())).toBe('mBank card');
  });

  it('converts between sort values and field/direction', () => {
    expect(parseSort('-date')).toEqual({ field: 'date', direction: 'desc' });
    expect(parseSort('merchant')).toEqual({ field: 'merchant', direction: 'asc' });
    expect(toSort(TransactionSortFieldEnum.Amount, 'desc')).toBe('-amount');
    expect(toSort(TransactionSortFieldEnum.Account, 'asc')).toBe('account');
  });
});
