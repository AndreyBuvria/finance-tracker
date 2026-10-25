import { formatMoney } from '@common/formatting/money.utils';
import { Transaction } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { transferLabel } from './transaction-display.utils';

/** "Expense added · −24,00 zł Eating out" (FEATURES.md F3) and its income/transfer variants. */
export function addedMessage(transaction: Transaction): string {
  return message(transaction).trimEnd();
}

function message(transaction: Transaction): string {
  const category = transaction.category?.name ?? '';
  switch (transaction.type) {
    case TransactionTypeEnum.Expense: {
      const amount = formatMoney(transaction.amount, 'expense');
      return $localize`:@@transactions.toast.addedExpense:Expense added · ${amount}:amount: ${category}:category:`;
    }
    case TransactionTypeEnum.Income: {
      const amount = formatMoney(transaction.amount, 'income');
      return $localize`:@@transactions.toast.addedIncome:Income added · ${amount}:amount: ${category}:category:`;
    }
    case TransactionTypeEnum.Transfer: {
      const amount = formatMoney(transaction.amount, 'transfer');
      const accounts = transferLabel(transaction);
      return $localize`:@@transactions.toast.addedTransfer:Transfer added · ${amount}:amount: ${accounts}:accounts:`;
    }
  }
}
