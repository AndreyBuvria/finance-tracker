import { Component, input, output, OutputEmitterRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Category } from '@common/categories/category.model';
import { CategoryMenuComponent } from '../common/categories/category-menu/category-menu.component';
import { CategoryGroup } from '../common/models/category-group.model';

/**
 * Contextual bar for selected rows (DESIGN.md: "3 selected · Change category · Delete"). With a
 * transfer selected there is no category to choose, so "Change category" reports `blocked` and the
 * page explains why.
 */
@Component({
  selector: 'app-bulk-bar',
  imports: [CategoryMenuComponent, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <div
      class="bar"
      role="region"
      aria-label="Selected transactions"
      i18n-aria-label="@@transactions.bulk.label"
    >
      <span class="count" i18n="@@transactions.bulk.count">{count(), plural,
        =1 {1 selected}
        other {{{ count() }} selected}
      }</span>
      @if (groups(); as choices) {
        <button
          matButton
          type="button"
          disabledInteractive
          [disabled]="busy()"
          [matMenuTriggerFor]="menu.menu()"
        >
          <mat-icon aria-hidden="true">sell</mat-icon>
          <span i18n="@@transactions.bulk.changeCategory">Change category</span>
        </button>
        <app-category-menu #menu [groups]="choices" (chosen)="categoryChosen.emit($event)" />
      } @else {
        <button
          matButton
          type="button"
          disabledInteractive
          [disabled]="busy()"
          (click)="whenIdle(blocked)"
        >
          <mat-icon aria-hidden="true">sell</mat-icon>
          <span i18n="@@transactions.bulk.changeCategory">Change category</span>
        </button>
      }
      <button
        matButton
        type="button"
        disabledInteractive
        [disabled]="busy()"
        (click)="whenIdle(deleteRequested)"
      >
        <mat-icon aria-hidden="true">delete</mat-icon>
        <span i18n="@@transactions.bulk.delete">Delete</span>
      </button>
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      padding: 4px 8px 4px 16px;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .count {
      margin-inline-end: auto;
      font: var(--mat-sys-title-small);
    }
  `,
})
export class BulkBarComponent {
  readonly count = input.required<number>();
  /** Categories the selection can move to; null when a transfer is selected. */
  readonly groups = input<readonly CategoryGroup[] | null>(null);
  /** A bulk action is running. */
  readonly busy = input(false);

  readonly categoryChosen = output<Category>();
  readonly blocked = output<void>();
  readonly deleteRequested = output<void>();

  /**
   * The buttons stay focusable while busy (`disabledInteractive`, so focus isn't lost), so clicks
   * are ignored here instead.
   */
  whenIdle(event: OutputEmitterRef<void>): void {
    if (!this.busy()) {
      event.emit();
    }
  }
}
