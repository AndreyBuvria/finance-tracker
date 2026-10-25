import { TransactionSort } from '@common/transactions/transaction.model';
import { SORT_COLUMN_LABELS } from '../common/constants/transaction-sort.constants';
import { parseSort } from './transaction-display.utils';

/** "Sorted by Amount, descending", announced after a sort change. */
export function sortAnnouncement(sort: TransactionSort): string {
  const { field, direction } = parseSort(sort);
  const column = SORT_COLUMN_LABELS[field];
  return direction === 'asc'
    ? $localize`:@@transactions.sort.announce.asc:Sorted by ${column}:column:, ascending`
    : $localize`:@@transactions.sort.announce.desc:Sorted by ${column}:column:, descending`;
}
