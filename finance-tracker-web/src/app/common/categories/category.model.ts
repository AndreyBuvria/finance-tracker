import { CategoryTypeEnum } from './category-type.enum';

/*
 * PLAN.md §7 "Categories contract (agreed)". Routes (under /api):
 * - GET /categories?includeArchived=false&type= → 200 CategoryList (active first, then archived;
 *   expense before income; then by name)
 * - GET /categories/top?limit=8&type= → 200 CategoryList (active only, most used in the last 90
 *   days, padded with the defaults)
 * - POST /categories CategoryRequest → 201 Category; 400; 409 "A category with this name already exists."
 * - PUT /categories/{id} CategoryRequest (full replace) → 200 Category; 409 duplicate name, "The type
 *   of a default category can't be changed.", "This category is already in use, so its type can't
 *   be changed."; 404
 * - DELETE /categories/{id} → 204 (with its budgets, rules and alerts); 409 has transactions /
 *   default / fallback; 404
 * - POST /categories/{id}/archive → 204; 409 fallback can't be hidden; 404
 * - POST /categories/{id}/restore → 204; 409 "A category with this name already exists. Rename it
 *   first."; 404
 * - POST /categories/{id}/merge { targetCategoryId } → 200 MergeCategoryResult; 400 on
 *   targetCategoryId; 409 fallback can't be merged, or "Merging would make a monthly budget too
 *   large. Lower one of the limits first."; 404
 */

export interface Category {
  id: string;
  name: string;
  type: CategoryTypeEnum;
  /** Rounded Material Symbols name from the fixed set (`src/styles/category-icons.constants.ts`). */
  icon: string;
  /** Lowercase `#rrggbb` from the fixed palette (`src/styles/category-palette.constants.ts`). */
  color: string;
  /** Key of a default category (e.g. `groceries`); null for custom categories. */
  systemKey: string | null;
  /** Hidden or archived: not offered in pickers, history kept. */
  isArchived: boolean;
  /** "Other" and "Other income": can't be hidden, merged or deleted. */
  isProtected: boolean;
  /** All of the user's transactions in this category (any date). */
  transactionCount: number;
  /** Monthly budgets of this category (any month). */
  budgetCount: number;
}

export interface CategoryList {
  items: Category[];
}

export interface CategoryListQuery {
  /** Also list archived categories, after the active ones. */
  includeArchived?: boolean;
  /** Only this type; all types when omitted. */
  type?: CategoryTypeEnum;
}

export interface TopCategoriesQuery {
  /** 1–50, default 8. */
  limit?: number;
  type?: CategoryTypeEnum;
}

/** Body of POST /categories and PUT /categories/{id} (a full replace). */
export interface CategoryRequest {
  /** 1–30 characters (trimmed); unique among the user's active categories of the same type. */
  name: string;
  /** Changes only for a custom category that isn't in use. */
  type: CategoryTypeEnum;
  /** From the fixed icon set. */
  icon: string;
  /** From the fixed palette. */
  color: string;
}

/** Response of POST /categories/{id}/merge; the source is archived afterwards. */
export interface MergeCategoryResult {
  transactionsMoved: number;
  /** Budgets moved, or added to the target's budget of the same month. */
  budgetsMoved: number;
  rulesMoved: number;
  /** The target with its updated counts. */
  target: Category;
}
