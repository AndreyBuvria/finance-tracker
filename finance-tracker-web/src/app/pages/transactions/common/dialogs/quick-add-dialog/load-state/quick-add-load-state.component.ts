import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/**
 * While the dialog's lists (accounts, categories) load: a light skeleton of the category tiles,
 * announced through a status region that is always present (only its text changes, so screen
 * readers pick the change up). If they can't be loaded: the generic error with "Try again".
 */
@Component({
  selector: 'app-quick-add-load-state',
  imports: [MatButtonModule],
  template: `
    <div role="status" class="visually-hidden">
      @if (loading()) {
        <span i18n="@@transactions.quickAdd.loading">Loading…</span>
      }
    </div>
    <!-- Loading first: while a retry reloads, the lists still report the previous error. -->
    @if (loading()) {
      <div class="loading" aria-hidden="true">
        <div class="tiles">
          @for (bone of bones; track bone) {
            <div class="skeleton-bone tile-bone"></div>
          }
        </div>
        <div class="skeleton-bone field-bone"></div>
      </div>
    } @else if (failed()) {
      <div class="load-error" role="alert">
        <p i18n="@@common.error.generic">Something went wrong. Try again.</p>
        <button matButton="tonal" type="button" (click)="retry.emit()">
          <span i18n="@@common.action.retry">Try again</span>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .load-error {
      display: grid;
      justify-items: start;
      gap: 8px;

      p {
        margin: 0;
      }
    }

    .loading {
      display: grid;
      gap: 16px;

      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
        gap: 8px;
      }
    }

    .tile-bone {
      height: 72px;
    }

    .field-bone {
      height: 56px;
    }
  `,
})
export class QuickAddLoadStateComponent {
  readonly loading = input.required<boolean>();
  readonly failed = input.required<boolean>();

  readonly retry = output<void>();

  protected readonly bones = [1, 2, 3, 4, 5, 6, 7, 8];
}
