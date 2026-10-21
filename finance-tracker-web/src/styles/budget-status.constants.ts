import { BudgetStatus, BudgetStatusVisual } from './budget-status.model';

/**
 * Visuals per budget status. Each status has a color token, a text label and an icon, so color is never the only signal
 * (FEATURES.md F6, §3 accessibility). Tokens are defined in `_semantic-colors.scss`.
 */
export const BUDGET_STATUS_VISUALS: Readonly<Record<BudgetStatus, BudgetStatusVisual>> = {
  ok: {
    colorVar: 'var(--app-color-ok)',
    containerVar: 'var(--app-color-ok-container)',
    onContainerVar: 'var(--app-color-on-ok-container)',
    icon: 'check_circle',
    label: $localize`:@@budget.status.ok:On track`,
  },
  warning: {
    colorVar: 'var(--app-color-warning)',
    containerVar: 'var(--app-color-warning-container)',
    onContainerVar: 'var(--app-color-on-warning-container)',
    icon: 'warning',
    label: $localize`:@@budget.status.warning:Almost there`,
  },
  over: {
    colorVar: 'var(--app-color-over)',
    containerVar: 'var(--app-color-over-container)',
    onContainerVar: 'var(--app-color-on-over-container)',
    icon: 'error',
    label: $localize`:@@budget.status.over:Over budget`,
  },
};
