import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { AppLayoutComponent } from './app-layout.component';
import { NavItem } from './navigation.model';

@Component({ template: '' })
class Blank {}

@Component({
  imports: [AppLayoutComponent],
  template: `
    <app-layout
      [navItems]="items"
      [userName]="name()"
      (addRequested)="onAdd()"
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
  readonly onAdd = vi.fn();
  readonly onLogout = vi.fn();
}

async function setup(desktop: boolean) {
  TestBed.configureTestingModule({
    providers: [
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
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, host: fixture.componentInstance };
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
    it('shows the navigation rail and the "Add" button with the N hint, no FAB', async () => {
      const { el } = await setup(true);
      expect(el.querySelector('nav.rail')).toBeTruthy();
      expect(el.querySelector('nav.bottom-nav')).toBeNull();
      expect(el.querySelector('.fab')).toBeNull();
      const add = el.querySelector<HTMLButtonElement>('.add-button');
      expect(add?.textContent).toContain('Add');
      expect(add?.querySelector('kbd')?.textContent).toBe('N');
      expect(add?.getAttribute('aria-keyshortcuts')).toBe('N');
    });

    it('requests Quick add from the "Add" button', async () => {
      const { el, host } = await setup(true);
      el.querySelector<HTMLButtonElement>('.add-button')?.click();
      expect(host.onAdd).toHaveBeenCalledTimes(1);
    });

    it('requests Quick add with the N shortcut', async () => {
      const { host } = await setup(true);
      const event = press(document.body, 'n');
      expect(host.onAdd).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
      press(document.body, 'N', { shiftKey: true });
      expect(host.onAdd).toHaveBeenCalledTimes(2);
    });

    it('ignores N while typing, with modifiers, on repeat or inside overlays', async () => {
      const { host } = await setup(true);
      const input = document.createElement('input');
      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-container';
      const insideOverlay = document.createElement('button');
      overlay.appendChild(insideOverlay);
      document.body.append(input, overlay);

      press(input, 'n');
      press(document.body, 'n', { ctrlKey: true });
      press(document.body, 'n', { metaKey: true });
      press(document.body, 'n', { repeat: true });
      press(insideOverlay, 'n');
      press(document.body, 'm');

      expect(host.onAdd).not.toHaveBeenCalled();
      input.remove();
      overlay.remove();
    });
  });

  describe('mobile', () => {
    it('shows bottom navigation and the floating "+" button, no "Add" button', async () => {
      const { el } = await setup(false);
      expect(el.querySelector('nav.bottom-nav')).toBeTruthy();
      expect(el.querySelector('nav.rail')).toBeNull();
      expect(el.querySelector('.add-button')).toBeNull();
      expect(el.querySelector('.fab')?.getAttribute('aria-label')).toBe('Add transaction');
      expect(el.querySelectorAll('nav.bottom-nav a')).toHaveLength(4);
    });

    it('requests Quick add from the floating button but not from the N key', async () => {
      const { el, host } = await setup(false);
      press(document.body, 'n');
      expect(host.onAdd).not.toHaveBeenCalled();
      el.querySelector<HTMLButtonElement>('.fab')?.click();
      expect(host.onAdd).toHaveBeenCalledTimes(1);
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
