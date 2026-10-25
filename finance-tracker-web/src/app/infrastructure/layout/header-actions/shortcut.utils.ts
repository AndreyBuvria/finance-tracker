/** Elements where a letter key is text input or widget navigation, not a page shortcut. */
const TYPING_TARGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="textbox"]',
  '[role="menu"]',
  '[role="radiogroup"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="treegrid"]',
  '[role="menubar"]',
  '[role="searchbox"]',
  'mat-select',
].join(', ');

/**
 * True when `event` presses the single-key shortcut `key` (e.g. `N`, either case): no Ctrl, Meta or
 * Alt, not a repeat, not already handled, not while typing, not inside an interactive widget that
 * uses letter keys (combobox, listbox, menu, menu bar, radio group, grid, tree, tree grid, search
 * box, `mat-select`) and not inside an open overlay (menu, dialog).
 */
export function isShortcutKey(event: KeyboardEvent, key: string): boolean {
  // Some browsers fire keydown without `key` (e.g. when autofill picks a value).
  if (typeof event.key !== 'string') {
    return false;
  }
  if (event.key.toLowerCase() !== key.toLowerCase() || event.repeat || event.defaultPrevented) {
    return false;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  return !(
    target.isContentEditable ||
    target.closest(TYPING_TARGETS) ||
    target.closest('.cdk-overlay-container')
  );
}
