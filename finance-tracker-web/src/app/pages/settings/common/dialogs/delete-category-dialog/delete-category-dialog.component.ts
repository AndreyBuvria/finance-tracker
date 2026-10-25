import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Category } from '@common/categories/category.model';

/**
 * Confirms deleting a custom category without transactions (FEATURES.md F5, PLAN.md §6): its
 * budgets, rules and alerts go with it. Closes with `true` to delete.
 */
@Component({
  selector: 'app-delete-category-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@settings.categories.delete.title">Delete {{ category.name }}?</h2>
    <mat-dialog-content>
      <p>
        <ng-container i18n="@@settings.categories.delete.body"
          >Its budgets, rules and alerts are deleted too. This can't be undone.</ng-container
        >
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">
        <span i18n="@@common.action.cancel">Cancel</span>
      </button>
      <button matButton="filled" type="button" class="delete" [mat-dialog-close]="true">
        <span i18n="@@settings.categories.delete.action">Delete</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
    }

    .delete {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DeleteCategoryDialogComponent {
  readonly category = inject<{ category: Category }>(MAT_DIALOG_DATA).category;
}
