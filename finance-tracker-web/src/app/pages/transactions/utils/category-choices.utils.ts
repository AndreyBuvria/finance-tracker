import { Category } from '@common/categories/category.model';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TRANSACTION_TYPE_LABELS } from '../common/constants/transaction-type.constants';
import { CategoryGroup } from '../common/models/category-group.model';

/**
 * Categories a transaction of these types can be moved to (PLAN.md §6 / §7 "Transactions
 * contract"): active categories only; expenses need an expense category; income may also use an
 * expense category (a refund). Returns null when a transfer is involved: transfers have no category.
 * Groups without categories are left out.
 */
export function categoryChoices(
  types: readonly TransactionTypeEnum[],
  categories: readonly Category[],
): CategoryGroup[] | null {
  if (types.length === 0 || types.includes(TransactionTypeEnum.Transfer)) {
    return null;
  }
  const active = (type: CategoryTypeEnum) =>
    categories.filter((category) => !category.isArchived && category.type === type);
  const expense: CategoryGroup = {
    label: TRANSACTION_TYPE_LABELS[TransactionTypeEnum.Expense],
    categories: active(CategoryTypeEnum.Expense),
  };
  const groups = types.every((type) => type === TransactionTypeEnum.Income)
    ? [
        {
          label: TRANSACTION_TYPE_LABELS[TransactionTypeEnum.Income],
          categories: active(CategoryTypeEnum.Income),
        },
        expense,
      ]
    : [expense];
  return groups.filter((group) => group.categories.length > 0);
}
