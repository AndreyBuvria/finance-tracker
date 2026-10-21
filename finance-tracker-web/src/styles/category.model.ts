import type { CATEGORY_ICONS } from './category-icons.constants';
import type { CATEGORY_PALETTE } from './category-palette.constants';

/** One color of the fixed category palette (FEATURES.md F5, DESIGN.md). */
export interface CategoryColor {
  /** `#RRGGBB`: the value a category stores and the API transfers (PLAN.md §5). */
  readonly hex: string;
  /** Text/icon color on top of `hex` (≥ 4.5:1, WCAG AA). */
  readonly onColor: string;
  /** Accessible name for the color picker. */
  readonly label: string;
}

/** A color from the fixed palette, e.g. `'#2e7d32'`. */
export type CategoryColorHex = (typeof CATEGORY_PALETTE)[number]['hex'];

/** A rounded Material Symbols name from the fixed category icon set. */
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
