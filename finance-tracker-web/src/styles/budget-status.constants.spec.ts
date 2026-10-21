import { BUDGET_STATUS_VISUALS } from './budget-status.constants';
import { BudgetStatus } from './budget-status.model';

describe('BUDGET_STATUS_VISUALS', () => {
  const statuses: BudgetStatus[] = ['ok', 'warning', 'over'];

  it('pairs every status with its own icon, label and color token (never color alone)', () => {
    const visuals = statuses.map((s) => BUDGET_STATUS_VISUALS[s]);
    for (const key of ['icon', 'label', 'colorVar', 'containerVar', 'onContainerVar'] as const) {
      expect(new Set(visuals.map((v) => v[key])).size).toBe(3);
    }
  });

  it('uses the FEATURES.md F6 wording for Warning', () => {
    expect(BUDGET_STATUS_VISUALS.warning.label).toBe('Almost there');
  });

  it('references the semantic CSS tokens', () => {
    expect(BUDGET_STATUS_VISUALS.ok.colorVar).toBe('var(--app-color-ok)');
    expect(BUDGET_STATUS_VISUALS.warning.colorVar).toBe('var(--app-color-warning)');
    expect(BUDGET_STATUS_VISUALS.over.colorVar).toBe('var(--app-color-over)');
  });
});
