import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { CategoryRequest } from '@common/categories/category.model';
import { notBlankValidator } from '@common/forms/not-blank.utils';
import { trimmedMaxLengthValidator } from '@common/forms/trimmed-max-length.utils';
import { hasStatus, problemDetail, validationErrors } from '@common/http/problem-details.utils';
import { DEFAULT_CATEGORY_ICON } from '@styles/category-icons.constants';
import { DEFAULT_CATEGORY_COLOR } from '@styles/category-palette.constants';
import { finalize, map, startWith } from 'rxjs';
import { CATEGORY_NAME_MAX_LENGTH } from '../../constants/category-limits.constants';
import {
  CategoryDialogData,
  CategoryDialogResult,
  CategoryTypeLock,
} from './category-dialog.model';
import { CategoryTypeFieldComponent } from './category-type-field/category-type-field.component';
import { ColorPickerComponent } from './color-picker/color-picker.component';
import { IconPickerComponent } from './icon-picker/icon-picker.component';

/** Fields the API reports validation errors on, matching the form control names. */
const SERVER_FIELDS = ['name', 'type', 'icon', 'color'] as const;

/**
 * The API's 409 messages about the type (PLAN.md §7 "Categories contract"). They go on Type; any
 * other 409 (the duplicate name) goes on Name.
 */
const TYPE_CONFLICTS: readonly string[] = [
  "The type of a default category can't be changed.",
  "This category is already in use, so its type can't be changed.",
];

/**
 * "Add category" / "Edit category" (FEATURES.md F5, DESIGN.md "Settings → Categories"): name (max
 * 30), type, icon (fixed set) and color (fixed palette). Defaults can be renamed and get another
 * icon or color, but keep their type; a custom category keeps its type once it has transactions or
 * budgets. Saves through the API itself and closes with the saved category.
 */
@Component({
  selector: 'app-category-dialog',
  imports: [
    CategoryTypeFieldComponent,
    ColorPickerComponent,
    IconPickerComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './category-dialog.component.html',
  styleUrl: './category-dialog.component.scss',
})
export class CategoryDialogComponent {
  protected readonly nameMaxLength = CATEGORY_NAME_MAX_LENGTH;

  private readonly data = inject<CategoryDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef =
    inject<MatDialogRef<CategoryDialogComponent, CategoryDialogResult>>(MatDialogRef);
  private readonly api = inject(CategoriesApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** The category being edited; null when adding. */
  readonly category = this.data?.category ?? null;

  readonly typeLock: CategoryTypeLock = !this.category
    ? null
    : this.category.systemKey
      ? 'default'
      : this.category.transactionCount > 0 || this.category.budgetCount > 0
        ? 'inUse'
        : null;

  // No `maxlength` attribute: the browser would silently cut pasted text instead of explaining.
  readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.category?.name ?? '',
      [notBlankValidator, trimmedMaxLengthValidator(CATEGORY_NAME_MAX_LENGTH)],
    ],
    type: [
      {
        value: this.category?.type ?? CategoryTypeEnum.Expense,
        disabled: this.typeLock !== null,
      },
      Validators.required,
    ],
    icon: [this.category?.icon ?? DEFAULT_CATEGORY_ICON, Validators.required],
    color: [this.category?.color ?? DEFAULT_CATEGORY_COLOR, Validators.required],
  });

  /** Errors of the pickers, for their messages (they are custom controls, not form fields). */
  readonly pickerErrors = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => ({
        icon: this.shownError('icon'),
        color: this.shownError('color'),
      })),
    ),
    { requireSync: true },
  );

  readonly submitting = signal(false);
  /** An unexpected error (e.g. offline): "Something went wrong. Try again." */
  readonly error = signal<'generic' | null>(null);

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const request = this.toRequest();
    this.submitting.set(true);
    const save$ = this.category
      ? this.api.update(this.category.id, request)
      : this.api.create(request);
    save$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (category) => this.dialogRef.close({ status: 'saved', category }),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private toRequest(): CategoryRequest {
    const { name, type, icon, color } = this.form.getRawValue();
    // PUT is a full replace, so a locked type is sent unchanged.
    return { name: name.trim(), type, icon, color };
  }

  /** "Choose an icon." etc.: the error to show for a picker, if touched. */
  private shownError(field: 'icon' | 'color'): string | 'required' | null {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) {
      return null;
    }
    const server: unknown = control.getError('server');
    return typeof server === 'string' ? server : 'required';
  }

  private handleError(error: unknown): void {
    if (this.category && hasStatus(error, 404)) {
      this.dialogRef.close({ status: 'notFound' });
      return;
    }
    const conflict = problemDetail(error, 409);
    if (conflict) {
      const field = TYPE_CONFLICTS.includes(conflict) ? 'type' : 'name';
      this.form.controls[field].setErrors({ server: conflict });
      this.form.controls[field].markAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const messages = validationErrors(error);
    const fields = SERVER_FIELDS.filter((field) => messages[field]);
    if (fields.length === 0) {
      this.error.set('generic');
      return;
    }
    for (const field of fields) {
      this.form.controls[field].setErrors({ server: messages[field] });
      this.form.controls[field].markAsTouched();
    }
    this.focusFirstInvalid();
  }

  /**
   * Focuses the first invalid field once the error state is rendered (after a server error the
   * `ng-invalid` classes only appear on the next render).
   */
  private focusFirstInvalid(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            'input.ng-invalid:not([type="radio"]), mat-button-toggle-group.ng-invalid button, ' +
              'app-icon-picker.invalid input[type="radio"], ' +
              'app-color-picker.invalid input[type="radio"]',
          )
          ?.focus(),
      { injector: this.injector },
    );
  }
}
