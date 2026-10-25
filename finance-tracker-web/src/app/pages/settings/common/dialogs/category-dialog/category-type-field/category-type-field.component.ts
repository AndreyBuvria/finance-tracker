import { Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { map, startWith, switchMap } from 'rxjs';
import { CATEGORY_TYPE_OPTIONS } from '../../../constants/category-type.constants';
import { CategoryTypeLock } from '../category-dialog.model';

/**
 * The category's Type (Expense / Income) with, when it can't change, the contract's reason as the
 * hint: a default category, or a custom one already in use. Shows "Choose a category type." or the
 * API's message on the field.
 */
@Component({
  selector: 'app-category-type-field',
  imports: [MatButtonToggleModule, ReactiveFormsModule],
  template: `
    <span id="category-type-label" class="field-label" i18n="@@settings.categories.field.type"
      >Type</span
    >
    <mat-button-toggle-group
      [formControl]="control()"
      aria-labelledby="category-type-label"
      [attr.aria-describedby]="
        error() ? 'category-type-error' : lock() ? 'category-type-hint' : null
      "
      hideSingleSelectionIndicator
    >
      @for (option of options; track option.type) {
        <mat-button-toggle [value]="option.type">{{ option.label }}</mat-button-toggle>
      }
    </mat-button-toggle-group>
    @if (error(); as message) {
      <p id="category-type-error" class="field-error">
        @if (message === 'required') {
          <ng-container i18n="@@settings.categories.field.type.required"
            >Choose a category type.</ng-container
          >
        } @else {
          {{ message }}
        }
      </p>
    } @else if (lock() === 'default') {
      <p id="category-type-hint" class="hint">
        <ng-container i18n="@@settings.categories.field.type.defaultLocked"
          >The type of a default category can't be changed.</ng-container
        >
      </p>
    } @else if (lock() === 'inUse') {
      <p id="category-type-hint" class="hint">
        <ng-container i18n="@@settings.categories.field.type.inUse"
          >This category is already in use, so its type can't be changed.</ng-container
        >
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }

    .field-label {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .hint,
    .field-error {
      margin: 0;
      font: var(--mat-sys-body-small);
    }

    .hint {
      color: var(--mat-sys-on-surface-variant);
    }

    .field-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class CategoryTypeFieldComponent {
  readonly control = input.required<FormControl<CategoryTypeEnum>>();
  /** Why the type can't change, if it can't. */
  readonly lock = input<CategoryTypeLock>(null);

  protected readonly options = CATEGORY_TYPE_OPTIONS;

  /** `required`, the API's message, or null; once touched. Followed through the control's events. */
  protected readonly error = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) =>
        control.events.pipe(
          startWith(null),
          map(() => {
            if (!control.touched || control.valid) {
              return null;
            }
            const server: unknown = control.getError('server');
            return typeof server === 'string' ? server : 'required';
          }),
        ),
      ),
    ),
    { initialValue: null },
  );
}
