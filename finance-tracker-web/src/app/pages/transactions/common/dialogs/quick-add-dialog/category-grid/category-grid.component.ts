import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { categoryOnColor } from '@common/categories/category-color.utils';
import { TransactionCategory } from '@common/transactions/transaction.model';
import { controlState } from '../../../../utils/control-state.utils';
import { CategoryGroup } from '../../../models/category-group.model';

/** Makes the element IDs unique per grid. */
let nextId = 0;

/** What a tile needs; both `Category` and a row's `TransactionCategory` fit. */
export type CategoryTile = Pick<TransactionCategory, 'id' | 'name' | 'icon' | 'color'>;

/**
 * Quick add category grid (FEATURES.md F3, DESIGN.md "Quick add dialog"): tiles of the most used
 * categories (icon, label, category color) and a "More" tile that shows every category the
 * transaction can use. One tile is selected. A selected category outside the top tiles (chosen
 * under "More", from a merchant, or kept on edit) gets a tile too.
 */
@Component({
  selector: 'app-category-grid',
  imports: [MatIconModule, NgTemplateOutlet],
  templateUrl: './category-grid.component.html',
  styleUrl: './category-grid.component.scss',
  host: { '[class.invalid]': 'state().showError' },
})
export class CategoryGridComponent {
  readonly control = input.required<FormControl<string>>();
  /** The most used categories, in order. */
  readonly top = input.required<readonly CategoryTile[]>();
  /** Everything selectable under "More". */
  readonly groups = input.required<readonly CategoryGroup[]>();
  /** Kept on edit even when hidden (an unchanged hidden category may stay). */
  readonly current = input<CategoryTile | null>(null);

  readonly expanded = signal(false);
  protected readonly ids = (() => {
    const id = `category-grid-${nextId++}`;
    return { label: `${id}-label`, all: `${id}-all`, error: `${id}-error` };
  })();
  readonly state = controlState(this.control, '');
  /** An API message put on the control (error `server`), shown instead of "Choose a category." */
  readonly serverError = computed(() => {
    const message: unknown = this.state().errors?.['server'];
    return typeof message === 'string' ? message : null;
  });

  readonly tiles = computed(() => {
    const top = this.top();
    const selected = this.find(this.state().value);
    return selected && !top.some((tile) => tile.id === selected.id) ? [...top, selected] : top;
  });

  onColor(tile: CategoryTile): string {
    return categoryOnColor(tile.color);
  }

  select(tile: CategoryTile): void {
    const control = this.control();
    control.setValue(tile.id);
    control.markAsDirty();
    control.markAsTouched();
    this.expanded.set(false);
  }

  private find(id: string): CategoryTile | null {
    if (!id) {
      return null;
    }
    const current = this.current();
    const all = [
      ...this.top(),
      ...this.groups().flatMap((group) => group.categories),
      ...(current ? [current] : []),
    ];
    return all.find((tile) => tile.id === id) ?? null;
  }
}
