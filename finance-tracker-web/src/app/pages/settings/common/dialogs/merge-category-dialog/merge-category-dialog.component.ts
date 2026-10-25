import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { categoryOnColor } from '@common/categories/category-color.utils';
import { hasStatus, problemDetail, validationErrors } from '@common/http/problem-details.utils';
import { finalize, startWith } from 'rxjs';
import { MergeCategoryDialogData, MergeCategoryDialogResult } from './merge-category-dialog.model';

/**
 * "Merge Coffee into…" (FEATURES.md F5, DESIGN.md "Settings → Categories"): pick an active category
 * of the same type; the confirmation line says what moves ("Move 34 transactions and 1 budget to
 * Eating out?", or "Merge Dog into Pets?" when nothing moves). Merges through the API itself and
 * closes with what moved.
 */
@Component({
  selector: 'app-merge-category-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './merge-category-dialog.component.html',
  styleUrl: './merge-category-dialog.component.scss',
})
export class MergeCategoryDialogComponent {
  private readonly data = inject<MergeCategoryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<MergeCategoryDialogComponent, MergeCategoryDialogResult>>(MatDialogRef);
  private readonly api = inject(CategoriesApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly source = this.data.source;
  readonly targets = this.data.targets;

  readonly form = inject(NonNullableFormBuilder).group({
    targetCategoryId: ['', Validators.required],
  });

  private readonly targetId = toSignal(
    this.form.controls.targetCategoryId.valueChanges.pipe(
      startWith(this.form.controls.targetCategoryId.value),
    ),
    { requireSync: true },
  );
  /** The chosen target, for the confirmation line ("Move 34 transactions and 1 budget to …?"). */
  readonly target = computed(() => this.targets.find((t) => t.id === this.targetId()) ?? null);

  readonly submitting = signal(false);
  /** A message without a field (e.g. a 409), or `generic`. */
  readonly error = signal<{ message: string } | 'generic' | null>(null);

  onColor(color: string): string {
    return categoryOnColor(color);
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    const control = this.form.controls.targetCategoryId;
    if (control.invalid) {
      control.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.api
      .merge(this.source.id, control.value)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.dialogRef.close({ status: 'merged', result }),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private handleError(error: unknown): void {
    if (hasStatus(error, 404)) {
      this.dialogRef.close({ status: 'notFound' });
      return;
    }
    const fieldMessage = validationErrors(error)['targetCategoryId'];
    if (fieldMessage) {
      this.form.controls.targetCategoryId.setErrors({ server: fieldMessage });
      this.form.controls.targetCategoryId.markAsTouched();
      return;
    }
    // E.g. "Merging would make a monthly budget too large. Lower one of the limits first."
    const conflict = problemDetail(error, 409);
    this.error.set(conflict ? { message: conflict } : 'generic');
  }
}
