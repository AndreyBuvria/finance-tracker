import { Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '@common/categories/category.model';
import { HIDDEN_CATEGORIES_TOGGLE_ID } from '../categories-settings.constants';
import { CategoryRowComponent } from '../category-row/category-row.component';

/**
 * Collapsed "Hidden & archived (n)" section (FEATURES.md F5, DESIGN.md "Settings → Categories")
 * with Rename and Restore per category, and Delete for an archived custom category without
 * transactions; not shown when there are none.
 */
@Component({
  selector: 'app-hidden-categories',
  imports: [CategoryRowComponent, MatButtonModule, MatIconModule],
  template: `
    @if (categories().length > 0) {
      <h3 class="heading">
        <button
          matButton
          type="button"
          [id]="toggleId"
          class="toggle"
          aria-controls="hidden-categories-list"
          [attr.aria-expanded]="expanded()"
          (click)="expanded.set(!expanded())"
        >
          <mat-icon aria-hidden="true">{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
          <span i18n="@@settings.categories.hiddenHeading"
            >Hidden &amp; archived ({{ categories().length }})</span
          >
        </button>
      </h3>
      <ul id="hidden-categories-list" class="list" [hidden]="!expanded()">
        @for (category of categories(); track category.id) {
          <li>
            <app-category-row
              [category]="category"
              [busy]="busy()"
              (renameRequested)="renameRequested.emit($event)"
              (restoreRequested)="restoreRequested.emit($event)"
              (deleteRequested)="deleteRequested.emit($event)"
            />
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .heading {
      margin: 24px 0 4px;
      font: var(--mat-sys-title-small);
    }

    .toggle {
      margin-left: -12px;
    }

    .list {
      margin: 0;
      padding: 0;
      list-style: none;

      li + li {
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class HiddenCategoriesComponent {
  readonly categories = input.required<readonly Category[]>();
  /** A change is in flight: the actions wait. */
  readonly busy = input(false);

  readonly renameRequested = output<Category>();
  readonly restoreRequested = output<Category>();
  readonly deleteRequested = output<Category>();

  protected readonly toggleId = HIDDEN_CATEGORIES_TOGGLE_ID;

  readonly expanded = signal(false);
}
