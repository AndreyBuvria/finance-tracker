import { CATEGORY_ICONS } from './category-icons.constants';

describe('CATEGORY_ICONS', () => {
  it('has 40 unique Material Symbols names', () => {
    expect(CATEGORY_ICONS).toHaveLength(40);
    expect(new Set(CATEGORY_ICONS).size).toBe(40);
  });

  it('uses ligature names (lowercase words joined by underscores)', () => {
    for (const icon of CATEGORY_ICONS) {
      expect(icon).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
