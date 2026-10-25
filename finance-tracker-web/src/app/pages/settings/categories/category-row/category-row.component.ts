import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { categoryOnColor } from '@common/categories/category-color.utils';
import { Category } from '@common/categories/category.model';

/** ID of the element that takes focus for a category's row (its actions). */
export function categoryActionsId(id: string): string {
  return `category-actions-${id}`;
}

/**
 * One category (DESIGN.md "Settings → Categories"): colored icon, name and transaction count.
 * - Active: a "⋮" menu. Defaults offer Rename, Hide and Merge into…; custom categories Rename,
 *   Archive (with transactions) or Delete (without), and Merge into…. The fallbacks ("Other",
 *   "Other income") offer only Rename and show a lock: "Used as the fallback category".
 * - Hidden or archived: a "Hidden"/"Archived" badge with Rename and Restore, and Delete for an
 *   archived custom category without transactions (e.g. a merged-away source).
 */
@Component({
  selector: 'app-category-row',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './category-row.component.html',
  styleUrl: './category-row.component.scss',
})
export class CategoryRowComponent {
  readonly category = input.required<Category>();
  /** A change is in flight: the actions wait. */
  readonly busy = input(false);

  readonly renameRequested = output<Category>();
  readonly hideRequested = output<Category>();
  readonly deleteRequested = output<Category>();
  readonly mergeRequested = output<Category>();
  readonly restoreRequested = output<Category>();

  readonly actionsId = computed(() => categoryActionsId(this.category().id));
  readonly onColor = computed(() => categoryOnColor(this.category().color));
  readonly isDefault = computed(() => this.category().systemKey !== null);
  /** A custom category with transactions is archived; without, it is deleted. */
  readonly canDelete = computed(() => !this.isDefault() && this.category().transactionCount === 0);

  readonly menuLabel = computed(
    () => $localize`:@@settings.categories.row.menu:More actions for ${this.category().name}:name:`,
  );
  readonly renameLabel = computed(
    () => $localize`:@@settings.categories.row.renameLabel:Rename ${this.category().name}:name:`,
  );
  readonly deleteLabel = computed(
    () => $localize`:@@settings.categories.row.deleteLabel:Delete ${this.category().name}:name:`,
  );
  readonly restoreLabel = computed(
    () => $localize`:@@settings.categories.row.restoreLabel:Restore ${this.category().name}:name:`,
  );
}
