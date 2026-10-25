import { CATEGORY_PALETTE } from '@styles/category-palette.constants';

/** Fallback text color for a color outside the palette (e.g. an older stored value). */
const FALLBACK_ON_COLOR = '#ffffff';

/**
 * Text/icon color to put on a category color (≥ 4.5:1 for palette colors, WCAG AA). The API stores
 * colors in lowercase; any case is accepted.
 */
export function categoryOnColor(hex: string): string {
  const lower = hex.toLowerCase();
  return CATEGORY_PALETTE.find((color) => color.hex === lower)?.onColor ?? FALLBACK_ON_COLOR;
}
