/** Elements where `N` is text input or widget navigation, not the Quick-add shortcut. */
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
 * `N` without modifiers, not while typing, not inside an interactive widget that uses letter keys
 * (combobox, listbox, menu, menu bar, radio group, grid, tree, tree grid, search box,
 * `mat-select`) and not inside an open overlay.
 */
export function isAddShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'n' || event.repeat || event.defaultPrevented) {
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
