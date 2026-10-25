import { categoryOnColor } from './category-color.utils';

describe('categoryOnColor', () => {
  it('returns the palette text color for a category color, in any letter case', () => {
    expect(categoryOnColor('#2e7d32')).toBe('#ffffff');
    expect(categoryOnColor('#FBC02D')).toBe('#1b1c1c');
  });

  it('falls back to white for a color outside the palette', () => {
    expect(categoryOnColor('#123456')).toBe('#ffffff');
  });
});
