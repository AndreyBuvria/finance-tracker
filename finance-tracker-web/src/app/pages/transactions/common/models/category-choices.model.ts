import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { CategoryGroup } from './category-group.model';

/** Categories a row of each type can move to (transfers have none). */
export type CategoryChoicesByType = Readonly<
  Partial<Record<TransactionTypeEnum, readonly CategoryGroup[]>>
>;
