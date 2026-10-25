import { MoneyKind } from '@common/formatting/money.model';
import { Transaction, TransactionSort } from '@common/transactions/transaction.model';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { DayGroup } from '../common/models/day-group.model';
import { SignedTotal } from '../common/models/signed-total.model';

/** How a transaction's amount is shown: "−" expense, "+" income, neutral transfer. */
export function moneyKind(type: TransactionTypeEnum): MoneyKind {
  switch (type) {
    case TransactionTypeEnum.Expense:
      return 'expense';
    case TransactionTypeEnum.Income:
      return 'income';
    case TransactionTypeEnum.Transfer:
      return 'transfer';
  }
}

/** Income positive, expense negative, transfer 0 (moves money without spending it). */
export function signedAmount(transaction: Transaction): number {
  switch (transaction.type) {
    case TransactionTypeEnum.Expense:
      return -transaction.amount;
    case TransactionTypeEnum.Income:
      return transaction.amount;
    case TransactionTypeEnum.Transfer:
      return 0;
  }
}

/** Shows a net amount with its sign: "−86,40 zł", "+12,00 zł" or "0,00 zł". */
export function signedTotal(amount: number): SignedTotal {
  const cents = Math.round(amount * 100);
  return {
    amount: Math.abs(cents) / 100,
    kind: cents < 0 ? 'expense' : cents > 0 ? 'income' : 'plain',
  };
}

/**
 * The total for "Delete 3 transactions (−212,00 zł)?": income − expenses of the selection. A
 * selection of transfers only shows the money they move, without a sign.
 */
export function selectionTotal(transactions: readonly Transaction[]): SignedTotal {
  const money = transactions.filter((t) => t.type !== TransactionTypeEnum.Transfer);
  if (money.length === 0) {
    return { amount: sumCents(transactions.map((t) => t.amount)), kind: 'transfer' };
  }
  return signedTotal(sumCents(money.map(signedAmount)));
}

/**
 * Consecutive rows of the same day, in list order (mobile: "Mon, 19 Oct · −86,40 zł"). Only rows
 * of the current page are counted.
 */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const transaction of transactions) {
    const last = groups.at(-1);
    if (last?.date === transaction.date) {
      last.items.push(transaction);
    } else {
      groups.push({ date: transaction.date, items: [transaction] });
    }
  }
  return groups.map((group) => ({
    ...group,
    total: sumCents(group.items.map(signedAmount)),
  }));
}

/** What the row is about: merchant, else note, else category, else the transfer's accounts. */
export function transactionTitle(transaction: Transaction): string {
  return (
    transaction.merchant ??
    transaction.note ??
    transaction.category?.name ??
    (transaction.transfer ? transferLabel(transaction) : '')
  );
}

/** "mBank card → Savings" for a transfer, the account name otherwise. */
export function transferLabel(transaction: Transaction): string {
  const transfer = transaction.transfer;
  return transfer
    ? `${transfer.fromAccount.name} → ${transfer.toAccount.name}`
    : transaction.account.name;
}

/** Sort field and direction of a `sort` value. */
export function parseSort(sort: TransactionSort): {
  field: TransactionSortFieldEnum;
  direction: 'asc' | 'desc';
} {
  const descending = sort.startsWith('-');
  return {
    field: (descending ? sort.slice(1) : sort) as TransactionSortFieldEnum,
    direction: descending ? 'desc' : 'asc',
  };
}

export function toSort(
  field: TransactionSortFieldEnum,
  direction: 'asc' | 'desc',
): TransactionSort {
  return direction === 'desc' ? `-${field}` : field;
}

/** Sums money without floating-point drift (0.1 + 0.2 = 0.3). */
function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
}
