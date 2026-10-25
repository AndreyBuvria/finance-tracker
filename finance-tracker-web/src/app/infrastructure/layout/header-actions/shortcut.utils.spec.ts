import { isShortcutKey } from './shortcut.utils';

const isNShortcut = (event: KeyboardEvent) => isShortcutKey(event, 'N');

describe('isShortcutKey', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => root.remove());

  function keydown(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  /** Builds `html` inside the test root and returns the element matching `#target`. */
  function element(html: string): HTMLElement {
    root.innerHTML = html;
    return root.querySelector<HTMLElement>('#target')!;
  }

  it('accepts N and Shift+N on the page', () => {
    const button = element('<button id="target" type="button">Go</button>');
    expect(isNShortcut(keydown(button))).toBe(true);
    expect(isNShortcut(keydown(button, { key: 'N', shiftKey: true }))).toBe(true);
    expect(isNShortcut(keydown(document))).toBe(true);
  });

  it('ignores other keys, modifiers, repeats and handled events', () => {
    const button = element('<button id="target" type="button">Go</button>');
    expect(isNShortcut(keydown(button, { key: 'm' }))).toBe(false);
    expect(isNShortcut(keydown(button, { ctrlKey: true }))).toBe(false);
    expect(isNShortcut(keydown(button, { metaKey: true }))).toBe(false);
    expect(isNShortcut(keydown(button, { altKey: true }))).toBe(false);
    expect(isNShortcut(keydown(button, { repeat: true }))).toBe(false);

    const handled = new KeyboardEvent('keydown', { key: 'n', cancelable: true });
    handled.preventDefault();
    expect(isNShortcut(handled)).toBe(false);
  });

  it.each([
    ['an input', '<input id="target" />'],
    ['a textarea', '<textarea id="target"></textarea>'],
    ['a native select', '<select id="target"><option>A</option></select>'],
    ['a contenteditable element', '<div contenteditable="true"><span id="target">x</span></div>'],
  ])('ignores N while typing in %s', (_, html) => {
    expect(isNShortcut(keydown(element(html)))).toBe(false);
  });

  it.each([
    'combobox',
    'listbox',
    'textbox',
    'searchbox',
    'menu',
    'menubar',
    'radiogroup',
    'grid',
    'tree',
    'treegrid',
  ])('ignores N inside [role=%s]', (role) => {
    const target = element(
      `<div role="${role}"><div><span id="target" tabindex="0">x</span></div></div>`,
    );
    expect(isNShortcut(keydown(target))).toBe(false);
  });

  it('ignores N inside mat-select', () => {
    const target = element('<mat-select><div id="target" tabindex="0">Account</div></mat-select>');
    expect(isNShortcut(keydown(target))).toBe(false);
  });

  it('ignores N inside an open overlay (menu, dialog)', () => {
    const target = element(
      '<div class="cdk-overlay-container"><button id="target" type="button">x</button></div>',
    );
    expect(isNShortcut(keydown(target))).toBe(false);
  });

  it('accepts N on an element with an unrelated role', () => {
    const target = element('<nav role="navigation"><a id="target" href="/x">x</a></nav>');
    expect(isNShortcut(keydown(target))).toBe(true);
  });

  it('matches the given key in either case', () => {
    const button = element('<button id="target" type="button">Go</button>');
    expect(isShortcutKey(keydown(button, { key: 'a' }), 'A')).toBe(true);
    expect(isShortcutKey(keydown(button, { key: 'n' }), 'A')).toBe(false);
  });

  it('ignores a keydown without a key (e.g. browser autofill)', () => {
    const event = new KeyboardEvent('keydown');
    Object.defineProperty(event, 'key', { value: undefined });
    expect(isShortcutKey(event, 'N')).toBe(false);
  });
});
