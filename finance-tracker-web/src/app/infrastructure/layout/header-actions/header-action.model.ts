/** One action of the current page, shown by the layout (top bar on desktop, "+" FAB on mobile). */
export interface HeaderAction {
  /** Stable ID, used for tracking in the template and in tests. */
  readonly id: string;
  /** Visible button text, e.g. "Add". */
  readonly label: string;
  /**
   * Full accessible name when the visible text alone is vague, e.g. "Add account". It must start
   * with `label` (WCAG 2.5.3 "Label in Name"). The mobile "+" button has no text, so it uses this.
   */
  readonly accessibleLabel?: string;
  /** Rounded Material Symbols name, e.g. `add`. */
  readonly icon: string;
  /** Single-key shortcut (desktop), e.g. `N`. Shown as a hint on the button. */
  readonly shortcut?: string;
  /** The page's main action: a filled button on desktop, the floating "+" on mobile. At most one. */
  readonly primary?: boolean;
  /** Runs when the button is pressed or the shortcut is used. */
  readonly handler: () => void;
}
