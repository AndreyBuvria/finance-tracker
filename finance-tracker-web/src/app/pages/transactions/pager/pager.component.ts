import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Previous / next page with "Page 2 of 3" (server-side paging, 50 per page). */
@Component({
  selector: 'app-pager',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <nav class="pager" aria-label="Pagination" i18n-aria-label="@@transactions.pager.label">
      <button
        mat-icon-button
        type="button"
        aria-label="Previous page"
        i18n-aria-label="@@transactions.pager.previous"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        <mat-icon aria-hidden="true">chevron_left</mat-icon>
      </button>
      <span class="position" aria-live="polite" i18n="@@transactions.pager.position"
        >Page {{ page() }} of {{ totalPages() }}</span
      >
      <button
        mat-icon-button
        type="button"
        aria-label="Next page"
        i18n-aria-label="@@transactions.pager.next"
        [disabled]="page() >= totalPages()"
        (click)="pageChange.emit(page() + 1)"
      >
        <mat-icon aria-hidden="true">chevron_right</mat-icon>
      </button>
    </nav>
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .position {
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly pageChange = output<number>();
}
