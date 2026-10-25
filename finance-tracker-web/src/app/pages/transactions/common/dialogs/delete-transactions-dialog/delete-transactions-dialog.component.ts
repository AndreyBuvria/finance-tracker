import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MoneyPipe } from '@common/pipes/money.pipe';
import { DeleteTransactionsDialogData } from './delete-transactions-dialog.model';

/**
 * Bulk delete confirmation (FEATURES.md F3): "Delete 3 transactions (−212,00 zł)?". Closes with
 * `true` when confirmed.
 */
@Component({
  selector: 'app-delete-transactions-dialog',
  imports: [MatButtonModule, MatDialogModule, MoneyPipe],
  template: `
    @let total = data.total.amount | money: data.total.kind;
    <h2 mat-dialog-title i18n="@@transactions.delete.title">
      {data.count, plural,
        =1 {Delete 1 transaction ({{ total }})?}
        other {Delete {{ data.count }} transactions ({{ total }})?}
      }
    </h2>
    @if (data.includesImported) {
      <mat-dialog-content>
        <p class="hint" i18n="@@transactions.delete.importedHint">
          This won't be re-imported from the same statement.
        </p>
      </mat-dialog-content>
    }
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close i18n="@@common.action.cancel">Cancel</button>
      <button matButton="filled" type="button" class="danger" [mat-dialog-close]="true">
        <span i18n="@@transactions.bulk.delete">Delete</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint {
      margin: 0;
    }

    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DeleteTransactionsDialogComponent {
  protected readonly data = inject<DeleteTransactionsDialogData>(MAT_DIALOG_DATA);
}
