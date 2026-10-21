/** One destination in the app navigation (rail/drawer on desktop, bottom bar on mobile). */
export interface NavItem {
  /** Router path, e.g. `AppRoutesEnum.Dashboard`. */
  readonly path: string;
  readonly label: string;
  /** Rounded Material Symbols name. */
  readonly icon: string;
}

/** `rail`: left rail on desktop (a drawer with inline labels from 1200 px); `bottom`: mobile bar. */
export type NavigationVariant = 'rail' | 'bottom';
