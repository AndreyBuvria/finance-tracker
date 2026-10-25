import { Category } from '@common/categories/category.model';
import { Transaction } from '@common/transactions/transaction.model';

/** The user picked a new category for one transaction (inline category change). */
export interface CategoryChange {
  readonly transaction: Transaction;
  readonly category: Category;
}
