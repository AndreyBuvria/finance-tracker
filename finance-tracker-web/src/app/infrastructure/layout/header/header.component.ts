import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AccountMenuComponent } from '../account-menu/account-menu.component';

/** Top bar: app name (home link), "Add" button with the `N` hint (desktop) and the avatar menu. */
@Component({
  selector: 'app-header',
  imports: [AccountMenuComponent, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <header class="top-bar">
      <a class="app-name" [routerLink]="homePath()" i18n="@@app.name">Finance Tracker</a>
      <span class="spacer"></span>
      @if (showAddButton()) {
        <button
          mat-flat-button
          type="button"
          class="add-button"
          aria-keyshortcuts="N"
          (click)="addRequested.emit()"
        >
          <mat-icon aria-hidden="true">add</mat-icon>
          <span i18n="@@shell.add">Add</span>
          <kbd class="shortcut" aria-hidden="true">N</kbd>
        </button>
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
  /** The "Add" button is desktop-only; mobile uses the floating "+" button. */
  readonly showAddButton = input(false);

  readonly addRequested = output<void>();
  readonly logoutRequested = output<void>();
}
