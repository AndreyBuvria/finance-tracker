/** Budget status (PLAN.md §6 Budgets): OK < 80 %, Warning 80–99.99 %, Over ≥ 100 %. */
export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetStatusVisual {
  /** Text/icon/bar color, e.g. `color: var(--app-color-ok)`. */
  readonly colorVar: string;
  /** Filled background for badges/chips, paired with `onContainerVar` text. */
  readonly containerVar: string;
  readonly onContainerVar: string;
  /** Rounded Material Symbols name. */
  readonly icon: string;
  readonly label: string;
}
