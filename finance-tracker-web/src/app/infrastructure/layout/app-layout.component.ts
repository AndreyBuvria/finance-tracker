import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { map } from 'rxjs';
import { HeaderComponent } from './header/header.component';
import { HeaderAction } from './header-actions/header-action.model';
import { HeaderActionsService } from './header-actions/header-actions.service';
import { isShortcutKey } from './header-actions/shortcut.utils';
import { DESKTOP_QUERY } from './layout.constants';
import { NavItem } from './navigation.model';
import { NavigationComponent } from './navigation/navigation.component';

/**
 * Layout for authenticated pages (DESIGN.md "APP SHELL"), composed of the header and the
 * navigation.
 * - Desktop (≥ 840 px): header with app name, the page's actions (the primary one with its
 *   shortcut hint, e.g. "Add N") and avatar menu; navigation rail on the left (a wider drawer
 *   from 1200 px). Action shortcuts work on desktop only, unless the user turned them off.
 * - Mobile: header with the avatar menu, bottom navigation and a floating "+" button for the
 *   page's primary action.
 *
 * The page's actions come from `HeaderActionsService`: the layout renders them and calls their
 * handlers, but never knows what they do. A page without actions shows no button.
 */
@Component({
  selector: 'app-layout',
  imports: [HeaderComponent, MatButtonModule, MatIconModule, NavigationComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
  host: {
    '[class.desktop]': 'isDesktop()',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class AppLayoutComponent {
  readonly navItems = input.required<readonly NavItem[]>();
  /** Display name for the avatar (initial) and the account menu label. */
  readonly userName = input('');
  readonly homePath = input<string>(AppRoutesEnum.Dashboard);
  readonly settingsPath = input<string>(AppRoutesEnum.Settings);
  /**
   * Single-key shortcuts (e.g. `N`) are on. When off (WCAG 2.1.4, a user setting), the keys do
   * nothing and their hints and `aria-keyshortcuts` are hidden.
   */
  readonly shortcutsEnabled = input(true);

  /** "Log out" in the account menu. */
  readonly logoutRequested = output<void>();

  private readonly breakpoints = inject(BreakpointObserver);
  private readonly dialog = inject(MatDialog);
  private readonly headerActions = inject(HeaderActionsService);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(DESKTOP_QUERY) },
  );

  /** The floating "+" (mobile only). */
  readonly fabAction = computed(() => (this.isDesktop() ? null : this.headerActions.primary()));

  /** Top-bar actions: all of them on desktop; on mobile the primary one is the floating "+". */
  readonly topBarActions = computed(() => {
    const actions = this.headerActions.actions();
    return this.isDesktop() ? actions : actions.filter((action) => !action.primary);
  });

  run(action: HeaderAction): void {
    action.handler();
  }

  skipToMain(event: Event): void {
    // A plain "#main-content" link would navigate to "/#main-content" because of <base href>.
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.shortcutsEnabled() || !this.isDesktop() || this.dialog.openDialogs.length > 0) {
      return;
    }
    const action = this.headerActions
      .actions()
      .find((candidate) => candidate.shortcut && isShortcutKey(event, candidate.shortcut));
    if (action) {
      event.preventDefault();
      this.run(action);
    }
  }
}
