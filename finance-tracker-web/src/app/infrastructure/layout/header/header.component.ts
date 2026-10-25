import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AccountMenuComponent } from '../account-menu/account-menu.component';
import { HeaderAction } from '../header-actions/header-action.model';

/**
 * Top bar: app name (home link), the page's actions and the avatar menu.
 * - `full` actions (desktop): text buttons, the primary one filled, with the shortcut hint
 *   (unless shortcuts are turned off).
 * - `icon` actions (mobile, except the primary one, which is the floating "+"): icon buttons.
 */
@Component({
  selector: 'app-header',
  imports: [AccountMenuComponent, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <header class="top-bar">
      <a class="app-name" [routerLink]="homePath()" i18n="@@app.name">Finance Tracker</a>
      <span class="spacer"></span>
      @for (action of actions(); track action.id) {
        @if (actionStyle() === 'full') {
          <button
            type="button"
            class="header-action"
            [class.primary]="action.primary"
            [matButton]="action.primary ? 'filled' : 'text'"
            [attr.aria-label]="action.accessibleLabel ?? null"
            [attr.aria-keyshortcuts]="(showShortcuts() && action.shortcut) || null"
            (click)="actionTriggered.emit(action)"
          >
            <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon>
            <span>{{ action.label }}</span>
            @if (showShortcuts() && action.shortcut) {
              <kbd class="shortcut" aria-hidden="true">{{ action.shortcut }}</kbd>
            }
          </button>
        } @else {
          <button
            mat-icon-button
            type="button"
            class="header-action"
            [attr.aria-label]="action.accessibleLabel ?? action.label"
            (click)="actionTriggered.emit(action)"
          >
            <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon>
          </button>
        }
      }
      <app-account-menu
        [userName]="userName()"
        [settingsPath]="settingsPath()"
        (logoutRequested)="logoutRequested.emit()"
      />
    </header>
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly homePath = input.required<string>();
  readonly settingsPath = input.required<string>();
  readonly userName = input('');
  readonly actions = input<readonly HeaderAction[]>([]);
  readonly actionStyle = input<'full' | 'icon'>('full');
  /** Shows the shortcut hints (and `aria-keyshortcuts`); off when the user disabled shortcuts. */
  readonly showShortcuts = input(true);

  readonly actionTriggered = output<HeaderAction>();
  readonly logoutRequested = output<void>();
}
