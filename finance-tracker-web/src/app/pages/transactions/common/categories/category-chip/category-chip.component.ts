import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Category } from '@common/categories/category.model';
import { categoryOnColor } from '@common/categories/category-color.utils';
import { TransactionCategory } from '@common/transactions/transaction.model';
import { CategoryMenuComponent } from '../category-menu/category-menu.component';
import { CategoryGroup } from '../../models/category-group.model';

/**
 * A transaction's category as a colored chip (DESIGN.md "Transactions"). Clicking it opens the
 * categories it can move to (inline category change, FEATURES.md F3); the parent saves the choice
 * and shows "Saved". Imported rows in a fallback category also show "Needs category" (F9).
 */
@Component({
  selector: 'app-category-chip',
  imports: [CategoryMenuComponent, MatIconModule, MatMenuModule],
  template: `
    @if (groups().length > 0) {
      <button
        type="button"
        class="chip"
        [style.background-color]="category().color"
        [style.color]="onColor()"
        [attr.aria-label]="changeLabel()"
        [attr.aria-disabled]="busy() || null"
        [matMenuTriggerFor]="categoryMenu.menu()"
      >
        <mat-icon aria-hidden="true">{{ category().icon }}</mat-icon>
        <span class="name">{{ category().name }}</span>
        <mat-icon class="caret" aria-hidden="true">arrow_drop_down</mat-icon>
      </button>
    } @else {
      <span class="chip" [style.background-color]="category().color" [style.color]="onColor()">
        <mat-icon aria-hidden="true">{{ category().icon }}</mat-icon>
        <span class="name">{{ category().name }}</span>
      </span>
    }
    <app-category-menu
      #categoryMenu
      [groups]="groups()"
      [currentId]="category().id"
      (chosen)="choose($event)"
    />
    @if (needsCategory()) {
      <span class="needs-category">
        <mat-icon aria-hidden="true">priority_high</mat-icon>
        <span i18n="@@transactions.category.needsCategory">Needs category</span>
      </span>
    }
    @if (saved()) {
      <span class="saved">
        <mat-icon aria-hidden="true">check</mat-icon>
        <span i18n="@@transactions.category.saved">Saved</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-width: 0;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      min-height: 32px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--mat-sys-corner-small);
      font: var(--mat-sys-label-large);

      mat-icon {
        flex: none;
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    }

    button.chip {
      padding-inline-end: 2px;
      cursor: pointer;

      // aria-disabled (not disabled) keeps focus on the chip while saving; the menu trigger
      // ignores clicks on an aria-disabled element.
      &[aria-disabled='true'] {
        cursor: default;
        opacity: 0.6;
      }
    }

    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .needs-category,
    .saved {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-label-medium);

      mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }

    .needs-category {
      color: var(--app-color-warning);
    }

    .saved {
      color: var(--app-color-ok);
    }
  `,
})
export class CategoryChipComponent {
  readonly category = input.required<TransactionCategory>();
  /** Categories it can move to; none makes the chip read-only. */
  readonly groups = input<readonly CategoryGroup[]>([]);
  /** A change of this row is being saved. */
  readonly busy = input(false);
  /** Shows the "Saved" confirmation. */
  readonly saved = input(false);
  readonly needsCategory = input(false);

  readonly categoryChosen = output<Category>();

  readonly onColor = computed(() => categoryOnColor(this.category().color));
  /** Starts with the visible name (WCAG 2.5.3 "Label in Name"). */
  readonly changeLabel = computed(
    () =>
      $localize`:@@transactions.category.changeLabel:${this.category().name}:name:, change category`,
  );

  choose(category: Category): void {
    if (category.id !== this.category().id) {
      this.categoryChosen.emit(category);
    }
  }
}
