import { CategoryTypeEnum } from '@common/categories/category-type.enum';

/** Category types in display order, with their labels (FEATURES.md F5). */
export const CATEGORY_TYPE_OPTIONS: readonly { type: CategoryTypeEnum; label: string }[] = [
  {
    type: CategoryTypeEnum.Expense,
    label: $localize`:@@settings.categories.type.expense:Expense`,
  },
  { type: CategoryTypeEnum.Income, label: $localize`:@@settings.categories.type.income:Income` },
];
