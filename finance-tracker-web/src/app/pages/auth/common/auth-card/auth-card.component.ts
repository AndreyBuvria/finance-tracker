import { Component } from '@angular/core';

/** Centered card layout for the login and register pages (no app layout). */
@Component({
  selector: 'app-auth-card',
  template: `
    <main class="auth-main">
      <div class="card">
        <p class="app-name" i18n="@@app.name">Finance Tracker</p>
        <ng-content />
      </div>
    </main>
  `,
  styles: `
    .auth-main {
      display: grid;
      place-items: start center;
      min-height: 100dvh;
      padding: 48px 16px;
      box-sizing: border-box;
    }

    .card {
      width: 100%;
      max-width: 400px;
      padding: 32px 24px;
      box-sizing: border-box;
      border-radius: var(--mat-sys-corner-extra-large);
      background: var(--mat-sys-surface-container-low);
    }

    .app-name {
      margin: 0 0 8px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-title-medium);
    }
  `,
})
export class AuthCardComponent {}
