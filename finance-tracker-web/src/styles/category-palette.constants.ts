import { CategoryColor } from './category.model';

/**
 * The fixed palette of 12 category colors (FEATURES.md F5, DESIGN.md, PLAN.md §5).
 * A category stores the `hex` value (`#RRGGBB`). Distinct hues that stay readable in charts.
 * Each color is also used as a chip/tile background, with `onColor` as the text/icon color on top
 * of it (≥ 4.5:1, WCAG AA, checked in `category-palette.constants.spec.ts`). The colors are the
 * same in light and dark mode.
 */
const ON_DARK = '#ffffff';
const ON_LIGHT = '#1b1c1c';

export const CATEGORY_PALETTE = [
  { hex: '#c62828', onColor: ON_DARK, label: $localize`:@@category.color.red:Red` },
  { hex: '#ad1457', onColor: ON_DARK, label: $localize`:@@category.color.pink:Pink` },
  { hex: '#7b1fa2', onColor: ON_DARK, label: $localize`:@@category.color.purple:Purple` },
  { hex: '#3949ab', onColor: ON_DARK, label: $localize`:@@category.color.indigo:Indigo` },
  { hex: '#1565c0', onColor: ON_DARK, label: $localize`:@@category.color.blue:Blue` },
  { hex: '#00838f', onColor: ON_DARK, label: $localize`:@@category.color.cyan:Cyan` },
  { hex: '#2e7d32', onColor: ON_DARK, label: $localize`:@@category.color.green:Green` },
  { hex: '#c0ca33', onColor: ON_LIGHT, label: $localize`:@@category.color.lime:Lime` },
  { hex: '#fbc02d', onColor: ON_LIGHT, label: $localize`:@@category.color.yellow:Yellow` },
  { hex: '#ef6c00', onColor: ON_LIGHT, label: $localize`:@@category.color.orange:Orange` },
  { hex: '#6d4c41', onColor: ON_DARK, label: $localize`:@@category.color.brown:Brown` },
  { hex: '#546e7a', onColor: ON_DARK, label: $localize`:@@category.color.blueGrey:Blue grey` },
] as const satisfies readonly CategoryColor[];

/** The neutral color a new category starts with (blue grey, as "Other"). */
export const DEFAULT_CATEGORY_COLOR = '#546e7a' satisfies (typeof CATEGORY_PALETTE)[number]['hex'];
