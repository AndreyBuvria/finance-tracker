import { contrastRatio, relativeLuminance } from './contrast.utils';

describe('contrast utils', () => {
  it('computes relative luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
  });

  it('computes WCAG contrast ratios regardless of argument order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#ffffff', '#777777')).toBeCloseTo(contrastRatio('#777777', '#ffffff'));
  });

  it('rejects malformed colors', () => {
    expect(() => relativeLuminance('red')).toThrow();
  });
});
