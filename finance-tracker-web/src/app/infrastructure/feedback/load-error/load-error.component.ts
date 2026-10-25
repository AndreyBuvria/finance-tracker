import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Full-page error for a failed load (FEATURES.md §3 "Feedback and errors", DESIGN.md "GENERAL
 * STATES"): "Something went wrong. Try again.", a "Try again" button and a small error ID.
 */
@Component({
  selector: 'app-load-error',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="error" role="alert">
      <mat-icon class="icon" aria-hidden="true">cloud_off</mat-icon>
      <p class="message" i18n="@@common.error.generic">Something went wrong. Try again.</p>
      <button matButton="filled" type="button" (click)="retry.emit()">
        <span i18n="@@common.action.retry">Try again</span>
      </button>
      @if (errorId(); as id) {
        <p class="error-id"><span i18n="@@common.error.id">Error ID:</span> {{ id }}</p>
      }
    </section>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      max-width: 560px;
      margin: 16px auto 0;
      padding: 32px 24px;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
      text-align: center;
    }

    .icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--mat-sys-on-surface-variant);
    }

    .message {
      margin: 0;
      font: var(--mat-sys-body-large);
    }

    .error-id {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      overflow-wrap: anywhere;
    }
  `,
})
export class LoadErrorComponent {
  /** Request trace ID for support, when the API returned one. */
  readonly errorId = input<string | null>(null);

  readonly retry = output<void>();
}
