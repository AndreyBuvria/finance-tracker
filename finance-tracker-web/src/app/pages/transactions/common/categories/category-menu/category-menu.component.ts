import { Component, input, output, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { Category } from '@common/categories/category.model';
import { CategoryGroup } from '../../models/category-group.model';

/**
 * Menu of categories to move transactions to, grouped by type. Open it with
 * `[matMenuTriggerFor]="categoryMenu.menu()"`.
 */
@Component({
  selector: 'app-category-menu',
  imports: [MatIconModule, MatMenuModule],
  template: `
    <mat-menu class="category-menu">
      @for (group of groups(); track group.label) {
        <div role="group" [attr.aria-label]="group.label">
          @if (groups().length > 1) {
            <div class="group-label" aria-hidden="true">{{ group.label }}</div>
          }
          @for (category of group.categories; track category.id) {
            <button
              mat-menu-item
              type="button"
              [attr.aria-current]="category.id === currentId() ? 'true' : null"
              (click)="chosen.emit(category)"
            >
              <mat-icon aria-hidden="true" [style.color]="category.color">{{
                category.icon
              }}</mat-icon>
              <span>{{ category.name }}</span>
              @if (category.id === currentId()) {
                <!-- Not a mat-icon: those are projected before the text. -->
                <span class="current material-symbols-rounded" aria-hidden="true">check</span>
              }
            </button>
          }
        </div>
      }
    </mat-menu>
  `,
  styles: `
    .group-label {
      padding: 8px 16px 4px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .current {
      margin-inline-start: 8px;
      font-size: 20px;
      vertical-align: middle;
    }
  `,
})
export class CategoryMenuComponent {
  readonly groups = input.required<readonly CategoryGroup[]>();
  /** The category the transaction already has (marked with a check). */
  readonly currentId = input<string | null>(null);

  readonly chosen = output<Category>();

  readonly menu = viewChild.required(MatMenu);
}
