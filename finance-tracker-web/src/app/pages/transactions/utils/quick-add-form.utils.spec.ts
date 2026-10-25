import { FormControl, FormGroup } from '@angular/forms';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { QuickAddFormValue } from '../common/models/quick-add-form.model';
import {
  applyQuickAddType,
  categoryFits,
  differentAccountsValidator,
  positiveAmountValidator,
  toTransactionRequest,
  toTransferRequest,
} from './quick-add-form.utils';

const value: QuickAddFormValue = {
  type: TransactionTypeEnum.Expense,
  amount: '24,5',
  categoryId: 'c1',
  merchant: '  Bolt ',
  note: ' ',
  date: new Date(2026, 9, 19),
  accountId: 'a1',
  fromAccountId: 'a1',
  toAccountId: 'a2',
};

describe('quick add form utils', () => {
  it('requires an amount greater than 0', () => {
    const errors = (text: string) => positiveAmountValidator(new FormControl(text));
    expect(errors('')).toEqual({ amountNotPositive: true });
    expect(errors('0,00')).toEqual({ amountNotPositive: true });
    expect(errors('-5')).toEqual({ amountNotPositive: true });
    expect(errors('12.50')).toBeNull();
    expect(errors('abc')).toBeNull();
  });

  it('requires two different accounts for a transfer', () => {
    const group = new FormGroup({
      fromAccountId: new FormControl('a1'),
      toAccountId: new FormControl('a1', differentAccountsValidator),
    });
    // The validator reads its sibling, which only exists once the group is built.
    group.controls.toAccountId.updateValueAndValidity();
    expect(group.controls.toAccountId.errors).toEqual({ sameAccounts: true });
    group.controls.toAccountId.setValue('a2');
    expect(group.controls.toAccountId.errors).toBeNull();
  });

  it('lets income use expense categories (refunds), not the other way round', () => {
    expect(categoryFits(TransactionTypeEnum.Expense, CategoryTypeEnum.Expense)).toBe(true);
    expect(categoryFits(TransactionTypeEnum.Expense, CategoryTypeEnum.Income)).toBe(false);
    expect(categoryFits(TransactionTypeEnum.Income, CategoryTypeEnum.Expense)).toBe(true);
    expect(categoryFits(TransactionTypeEnum.Income, CategoryTypeEnum.Income)).toBe(true);
  });

  it('builds an expense or income request with trimmed optional text', () => {
    expect(toTransactionRequest(value)).toEqual({
      type: 'Expense',
      amount: 24.5,
      date: '2026-10-19',
      accountId: 'a1',
      categoryId: 'c1',
      merchant: 'Bolt',
      note: null,
    });
    expect(toTransactionRequest({ ...value, type: TransactionTypeEnum.Income }).type).toBe(
      'Income',
    );
  });

  it('builds a transfer request', () => {
    expect(toTransferRequest({ ...value, note: ' Holiday ' })).toEqual({
      fromAccountId: 'a1',
      toAccountId: 'a2',
      amount: 24.5,
      date: '2026-10-19',
      note: 'Holiday',
    });
  });
});

describe('applyQuickAddType', () => {
  const controls = () => {
    const c = (value = '') => new FormControl(value, { nonNullable: true });
    return {
      categoryId: c('cat'),
      merchant: c('Bolt'),
      accountId: c('a1'),
      fromAccountId: c('a1'),
      toAccountId: c('a2'),
      note: c('Holiday'),
    };
  };
  const enabled = (cs: ReturnType<typeof controls>) =>
    Object.entries(cs)
      .filter(([, control]) => control.enabled)
      .map(([name]) => name);

  it('enables category, merchant and account for an expense', () => {
    const cs = controls();
    applyQuickAddType(cs, TransactionTypeEnum.Expense, false, CategoryTypeEnum.Expense);
    expect(enabled(cs)).toEqual(['categoryId', 'merchant', 'accountId']);
    expect(cs.note.value).toBe('');
    expect(cs.categoryId.value).toBe('cat');
  });

  it('enables from/to accounts and the note for a transfer', () => {
    const cs = controls();
    applyQuickAddType(cs, TransactionTypeEnum.Transfer, true, null);
    expect(enabled(cs)).toEqual(['fromAccountId', 'toAccountId', 'note']);
    expect(cs.note.value).toBe('Holiday');
  });

  it('drops a category that does not fit the type', () => {
    const cs = controls();
    applyQuickAddType(cs, TransactionTypeEnum.Expense, true, CategoryTypeEnum.Income);
    expect(cs.categoryId.value).toBe('');
    const income = controls();
    applyQuickAddType(income, TransactionTypeEnum.Income, true, CategoryTypeEnum.Expense);
    expect(income.categoryId.value).toBe('cat');
  });
});
