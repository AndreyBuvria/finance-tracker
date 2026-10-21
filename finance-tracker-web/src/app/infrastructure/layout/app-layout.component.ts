import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppRoutesEnum } from '@common/routing/app-routes.enum';
import { map } from 'rxjs';
import { isAddShortcut } from './add-shortcut.utils';
import { HeaderComponent } from './header/header.component';
import { DESKTOP_QUERY } from './layout.constants';
import { NavItem } from './navigation.model';
import { NavigationComponent } from './navigation/navigation.component';

/**
 * Layout for authenticated pages (DESIGN.md "APP SHELL"), composed of the header and the
 * navigation.
 * - Desktop (≥ 840 px): header with app name, "Add" button (shortcut `N`) and avatar menu;
 *   navigation rail on the left (a wider drawer from 1200 px).
 * - Mobile: header with the avatar menu, bottom navigation and a floating "+" button.
 *
 * Presentational: the page content is projected, actions are reported through outputs.
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

  /** "Add" / "+" button or the `N` shortcut (desktop). */
  readonly addRequested = output<void>();
  /** "Log out" in the account menu. */
  readonly logoutRequested = output<void>();

  private readonly breakpoints = inject(BreakpointObserver);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(DESKTOP_QUERY) },
  );

  skipToMain(event: Event): void {
    // A plain "#main-content" link would navigate to "/#main-content" because of <base href>.
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.isDesktop() && isAddShortcut(event)) {
      event.preventDefault();
      this.addRequested.emit();
    }
  }
}
