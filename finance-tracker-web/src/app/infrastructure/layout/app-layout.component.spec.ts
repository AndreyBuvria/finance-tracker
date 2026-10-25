import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { AppLayoutComponent } from './app-layout.component';
import { HeaderAction } from './header-actions/header-action.model';
import { HeaderActionsService } from './header-actions/header-actions.service';
import { NavItem } from './navigation.model';

@Component({ template: '' })
class Blank {}

@Component({
  imports: [AppLayoutComponent],
  template: `
    <app-layout
      [navItems]="items"
      [userName]="name()"
      [shortcutsEnabled]="shortcuts()"
      (logoutRequested)="onLogout()"
    >
      <p class="projected">Page content</p>
    </app-layout>
  `,
})
class Host {
  readonly items: NavItem[] = [
    { path: AppRoutesEnum.Dashboard, label: 'Dashboard', icon: 'dashboard' },
    { path: AppRoutesEnum.Transactions, label: 'Transactions', icon: 'receipt_long' },
    { path: AppRoutesEnum.Accounts, label: 'Accounts', icon: 'account_balance_wallet' },
    { path: AppRoutesEnum.Settings, label: 'Settings', icon: 'settings' },
  ];
  readonly name = signal('Kasia');
  readonly shortcuts = signal(true);
  readonly onLogout = vi.fn();
}

interface SetupOptions {
  /** Register a primary "Add" (shortcut N) like a page would. Default: true. */
  withActions?: boolean;
  openDialogs?: unknown[];
}

async function setup(
  desktop: boolean,
  { withActions = true, openDialogs = [] }: SetupOptions = {},
) {
  const onAdd = vi.fn();
  const onExport = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialog, useValue: { openDialogs } },
      provideRouter([
        { path: 'dashboard', component: Blank },
        { path: 'settings', component: Blank },
      ]),
      {
        provide: BreakpointObserver,
        useValue: {
          observe: () => of({ matches: desktop, breakpoints: {} }),
          isMatched: () => desktop,
        },
      },
    ],
  });
  await TestBed.inject(Router).navigateByUrl('/dashboard');
  const actions = TestBed.inject(HeaderActionsService);
  const unregister = withActions
    ? actions.register([
        {
          id: 'export',
          label: 'Export',
          accessibleLabel: 'Export accounts',
          icon: 'download',
          handler: onExport,
        },
        {
          id: 'add',
          label: 'Add',
          accessibleLabel: 'Add account',
          icon: 'add',
          shortcut: 'N',
          primary: true,
          handler: onAdd,
        } satisfies HeaderAction,
      ])
    : () => undefined;
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, host: fixture.componentInstance, onAdd, onExport, unregister };
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('AppLayoutComponent', () => {
  it('renders banner, main navigation and main landmarks with the projected page', async () => {
    const { el } = await setup(true);
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(1);
    expect(el.querySelector('main#main-content .projected')?.textContent).toBe('Page content');
  });

  it('marks the active destination with aria-current="page"', async () => {
    const { el } = await setup(true);
    const current = el.querySelectorAll('nav a[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Dashboard');
  });

  describe('desktop', () => {
    it('shows the navigation rail and the page actions, the primary one with its N hint', async () => {
      const { el } = await setup(true);
      expect(el.querySelector('nav.rail')).toBeTruthy();
      expect(el.querySelector('nav.bottom-nav')).toBeNull();
      expect(el.querySelector('.fab')).toBeNull();
      const buttons = el.querySelectorAll<HTMLButtonElement>('.header-action');
      expect(buttons).toHaveLength(2);
      const add = el.querySelector<HTMLButtonElement>('.header-action.primary');
      expect(add?.textContent).toContain('Add');
      expect(add?.getAttribute('aria-label')).toBe('Add account');
      expect(add?.querySelector('kbd')?.textContent).toBe('N');
      expect(add?.getAttribute('aria-keyshortcuts')).toBe('N');
      expect(buttons[0].querySelector('kbd')).toBeNull();
      expect(buttons[0].getAttribute('aria-keyshortcuts')).toBeNull();
    });

    it('calls the handler of the pressed action', async () => {
      const { el, onAdd, onExport } = await setup(true);
      el.querySelector<HTMLButtonElement>('.header-action.primary')?.click();
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onExport).not.toHaveBeenCalled();
      el.querySelectorAll<HTMLButtonElement>('.header-action')[0].click();
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('routes the N shortcut to the primary action', async () => {
      const { onAdd } = await setup(true);
      const event = press(document.body, 'n');
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
      press(document.body, 'N', { shiftKey: true });
      expect(onAdd).toHaveBeenCalledTimes(2);
    });

    it('ignores N while typing, with modifiers, on repeat or inside overlays', async () => {
      const { onAdd } = await setup(true);
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-container';
      const insideOverlay = document.createElement('button');
      overlay.appendChild(insideOverlay);
      document.body.append(input, textarea, editable, overlay);

      press(input, 'n');
      press(textarea, 'n');
      press(editable, 'n');
      press(document.body, 'n', { ctrlKey: true });
      press(document.body, 'n', { metaKey: true });
      press(document.body, 'n', { altKey: true });
      press(document.body, 'n', { repeat: true });
      press(insideOverlay, 'n');
      press(document.body, 'm');

      expect(onAdd).not.toHaveBeenCalled();
      [input, textarea, editable, overlay].forEach((node) => node.remove());
    });

    it('ignores N while a dialog is open', async () => {
      const { onAdd } = await setup(true, { openDialogs: [{}] });
      const event = press(document.body, 'n');
      expect(onAdd).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('shows no action and ignores N when the page registered none', async () => {
      const { el, onAdd } = await setup(true, { withActions: false });
      expect(el.querySelector('.header-action')).toBeNull();
      const event = press(document.body, 'n');
      expect(onAdd).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('ignores N and hides its hint when the user turned shortcuts off', async () => {
      const { el, fixture, host, onAdd } = await setup(true);
      host.shortcuts.set(false);
      await fixture.whenStable();
      const add = el.querySelector<HTMLButtonElement>('.header-action.primary')!;
      expect(add.querySelector('kbd')).toBeNull();
      expect(add.hasAttribute('aria-keyshortcuts')).toBe(false);
      const event = press(document.body, 'n');
      expect(onAdd).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);

      // The button itself still works.
      add.click();
      expect(onAdd).toHaveBeenCalledTimes(1);

      host.shortcuts.set(true);
      await fixture.whenStable();
      expect(add.querySelector('kbd')?.textContent).toBe('N');
      press(document.body, 'n');
      expect(onAdd).toHaveBeenCalledTimes(2);
    });

    it('removes the buttons when the page unregisters its actions', async () => {
      const { el, fixture, unregister, onAdd } = await setup(true);
      unregister();
      await fixture.whenStable();
      expect(el.querySelector('.header-action')).toBeNull();
      press(document.body, 'n');
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe('mobile', () => {
    it('shows bottom navigation and the floating "+" for the primary action', async () => {
      const { el } = await setup(false);
      expect(el.querySelector('nav.bottom-nav')).toBeTruthy();
      expect(el.querySelector('nav.rail')).toBeNull();
      expect(el.querySelector('.header-action.primary')).toBeNull();
      const fab = el.querySelector('.fab');
      expect(fab?.getAttribute('aria-label')).toBe('Add account');
      expect(fab?.querySelector('mat-icon')?.textContent).toBe('add');
      expect(el.querySelectorAll('nav.bottom-nav a')).toHaveLength(4);
    });

    it('shows other actions as labelled icon buttons in the top bar', async () => {
      const { el, onExport } = await setup(false);
      const buttons = el.querySelectorAll<HTMLButtonElement>('header .header-action');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].getAttribute('aria-label')).toBe('Export accounts');
      buttons[0].click();
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('calls the primary handler from the floating button but not from the N key', async () => {
      const { el, onAdd } = await setup(false);
      press(document.body, 'n');
      expect(onAdd).not.toHaveBeenCalled();
      el.querySelector<HTMLButtonElement>('.fab')?.click();
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('shows no floating button when the page has no primary action', async () => {
      const { el } = await setup(false, { withActions: false });
      expect(el.querySelector('.fab')).toBeNull();
    });
  });

  describe('account menu', () => {
    it('shows the user initial and names the menu after the user', async () => {
      const { el, fixture, host } = await setup(true);
      const trigger = el.querySelector('.avatar-button');
      expect(trigger?.textContent?.trim()).toBe('K');
      expect(trigger?.getAttribute('aria-label')).toBe('Account menu for Kasia');

      host.name.set('');
      await fixture.whenStable();
      expect(trigger?.getAttribute('aria-label')).toBe('Account menu');
      expect(trigger?.querySelector('mat-icon')?.textContent).toBe('account_circle');
    });

    it('offers Settings and Log out; Log out is reported to the parent', async () => {
      const { el, fixture, host } = await setup(true);
      el.querySelector<HTMLButtonElement>('.avatar-button')?.click();
      await fixture.whenStable();
      const items = Array.from(document.querySelectorAll<HTMLElement>('[mat-menu-item]'));
      expect(items.map((i) => i.textContent?.trim())).toEqual([
        'settingsSettings',
        'logoutLog out',
      ]);
      expect(items[0].getAttribute('href')).toBe('/settings');
      items[1].click();
      expect(host.onLogout).toHaveBeenCalledTimes(1);
    });
  });

  it('moves focus to the main content from the skip link', async () => {
    const { el } = await setup(true);
    const skip = el.querySelector<HTMLAnchorElement>('.skip-link');
    expect(skip?.textContent?.trim()).toBe('Skip to main content');
    skip?.click();
    expect(document.activeElement).toBe(el.querySelector('main'));
  });
});
