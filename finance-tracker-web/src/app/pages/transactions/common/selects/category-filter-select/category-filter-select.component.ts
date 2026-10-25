import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Category } from '@common/categories/category.model';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TRANSACTION_TYPE_LABELS } from '../../constants/transaction-type.constants';
import { CategoryGroup } from '../../models/category-group.model';

/**
 * Category filter (multi-select, FEATURES.md F3), grouped Expense / Income. Hidden categories are
 * listed last so their history stays findable. No selection means all categories.
 */
@Component({
  selector: 'app-category-filter-select',
  imports: [MatFormFieldModule, MatIconModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.filter.category">Category</mat-label>
      <mat-select [formControl]="control()" multiple>
        @for (group of groups(); track group.label) {
          <mat-optgroup [label]="group.label">
            @for (category of group.categories; track category.id) {
              <mat-option [value]="category.id">
                <mat-icon aria-hidden="true" [style.color]="category.color">{{
                  category.icon
                }}</mat-icon>
                {{ category.name }}
              </mat-option>
            }
          </mat-optgroup>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class CategoryFilterSelectComponent {
  readonly control = input.required<FormControl<string[]>>();
  readonly categories = input.required<readonly Category[]>();

  readonly groups = computed<CategoryGroup[]>(() => {
    const all = this.categories();
    const active = (type: CategoryTypeEnum) => all.filter((c) => !c.isArchived && c.type === type);
    return [
      {
        label: TRANSACTION_TYPE_LABELS[TransactionTypeEnum.Expense],
        categories: active(CategoryTypeEnum.Expense),
      },
      {
        label: TRANSACTION_TYPE_LABELS[TransactionTypeEnum.Income],
        categories: active(CategoryTypeEnum.Income),
      },
      {
        label: $localize`:@@transactions.filter.category.hidden:Hidden`,
        categories: all.filter((c) => c.isArchived),
      },
    ].filter((group) => group.categories.length > 0);
  });
}
