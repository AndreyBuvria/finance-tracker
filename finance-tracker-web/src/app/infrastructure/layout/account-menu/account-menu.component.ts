import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';

/** Avatar button (user initial) with the account menu: Settings and Log out. */
@Component({
  selector: 'app-account-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, RouterLink],
  template: `
    <button
      mat-icon-button
      type="button"
      class="avatar-button"
      [matMenuTriggerFor]="accountMenu"
      [attr.aria-label]="label()"
    >
      @if (initial()) {
        <span class="avatar" aria-hidden="true">{{ initial() }}</span>
      } @else {
        <mat-icon aria-hidden="true">account_circle</mat-icon>
      }
    </button>
    <mat-menu #accountMenu="matMenu" xPosition="before">
      <a mat-menu-item [routerLink]="settingsPath()">
        <mat-icon aria-hidden="true">settings</mat-icon>
        <span i18n="@@shell.accountMenu.settings">Settings</span>
      </a>
      <button mat-menu-item type="button" (click)="logoutRequested.emit()">
        <mat-icon aria-hidden="true">logout</mat-icon>
        <span i18n="@@shell.accountMenu.logout">Log out</span>
      </button>
    </mat-menu>
  `,
  styles: `
    .avatar {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-title-medium);
    }
  `,
})
export class AccountMenuComponent {
  /** Display name; empty shows a generic avatar. */
  readonly userName = input('');
  readonly settingsPath = input.required<string>();

  readonly logoutRequested = output<void>();

  readonly initial = computed(() => this.userName().trim().charAt(0).toLocaleUpperCase());

  readonly label = computed(() => {
    const name = this.userName().trim();
    return name
      ? $localize`:@@shell.accountMenu.labelWithName:Account menu for ${name}:name:`
      : $localize`:@@shell.accountMenu.label:Account menu`;
  });
}
