import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '@common/auth/auth.service';
import { ShortcutsPreferenceService } from '@common/preferences/shortcuts-preference.service';
import { of, Subject, throwError } from 'rxjs';
import { AuthenticatedLayoutComponent } from './authenticated-layout.component';

describe('AuthenticatedLayoutComponent', () => {
  async function setup(
    me = of({ id: '1', email: 'k@e.com', displayName: 'Kasia', onboardingCompletedAt: null }),
  ) {
    const logout$ = new Subject<void>();
    const auth = { me: vi.fn(() => me), logout: vi.fn(() => logout$) };
    const shortcuts = { enabled: signal(true), load: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ShortcutsPreferenceService, useValue: shortcuts },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: true, breakpoints: {} }),
            isMatched: () => true,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AuthenticatedLayoutComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, auth, logout$, shortcuts };
  }

  it('shows the current user in the account menu', async () => {
    const { el } = await setup();
    expect(el.querySelector('.avatar-button')?.getAttribute('aria-label')).toBe(
      'Account menu for Kasia',
    );
  });

  it('falls back to a generic avatar when the user cannot be loaded', async () => {
    const { el } = await setup(throwError(() => new Error('offline')));
    expect(el.querySelector('.avatar-button')?.getAttribute('aria-label')).toBe('Account menu');
  });

  it("loads the user's shortcut choice and passes it to the layout", async () => {
    const { el, fixture, shortcuts } = await setup();
    expect(shortcuts.load).toHaveBeenCalledTimes(1);
    const layout = () =>
      fixture.debugElement.query((node) => node.name === 'app-layout').componentInstance as {
        shortcutsEnabled: () => boolean;
      };
    expect(layout().shortcutsEnabled()).toBe(true);
    shortcuts.enabled.set(false);
    await fixture.whenStable();
    expect(layout().shortcutsEnabled()).toBe(false);
    expect(el.querySelector('app-layout')).toBeTruthy();
  });

  it('logs out and goes to the login page', async () => {
    const { el, fixture, auth, logout$ } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.avatar-button')!.click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('[mat-menu-item]')[1].click();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    logout$.next();
    expect(navigate).toHaveBeenCalledWith('/auth/login');
  });
});
