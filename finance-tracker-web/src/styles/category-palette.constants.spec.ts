import { CATEGORY_PALETTE } from './category-palette.constants';
import { contrastRatio } from './testing/contrast.utils';

describe('CATEGORY_PALETTE', () => {
  it('has 12 unique colors', () => {
    expect(CATEGORY_PALETTE).toHaveLength(12);
    expect(new Set(CATEGORY_PALETTE.map((c) => c.hex)).size).toBe(12);
  });

  it('stores colors as lowercase #RRGGBB hex (PLAN.md §5)', () => {
    for (const color of CATEGORY_PALETTE) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(CATEGORY_PALETTE.map((c) => [c.hex, c] as const))(
    '%s is AA-legible as a chip background (text ≥ 4.5:1)',
    (_hex, color) => {
      expect(contrastRatio(color.hex, color.onColor)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('has a unique label for every color (color picker accessible names)', () => {
    const labels = CATEGORY_PALETTE.map((c) => c.label.trim());
    expect(labels.every((l) => l !== '')).toBe(true);
    expect(new Set(labels).size).toBe(12);
  });
});
