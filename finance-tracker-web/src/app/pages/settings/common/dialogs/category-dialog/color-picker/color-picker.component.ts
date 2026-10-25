import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CATEGORY_PALETTE } from '@styles/category-palette.constants';

/** Makes the radio group names unique per picker. */
let nextId = 0;

/**
 * Color picker for a category (DESIGN.md "Settings → Categories": 12 swatches, the fixed palette).
 * Native radio buttons named after the color; the chosen one also shows a check mark, so color is
 * never the only signal.
 */
@Component({
  selector: 'app-color-picker',
  imports: [MatIconModule, ReactiveFormsModule],
  template: `
    <fieldset class="picker" [attr.aria-describedby]="describedBy()">
      <legend class="label" i18n="@@settings.categories.field.color">Color</legend>
      <div class="swatches">
        @for (color of palette; track color.hex) {
          <label class="swatch" [title]="color.label" [style.background-color]="color.hex">
            <input
              type="radio"
              class="radio"
              [name]="name"
              [attr.name]="name"
              [value]="color.hex"
              [formControl]="control()"
              [attr.aria-label]="color.label"
            />
            <mat-icon class="check" aria-hidden="true" [style.color]="color.onColor"
              >check</mat-icon
            >
          </label>
        }
      </div>
    </fieldset>
  `,
  styleUrl: './color-picker.component.scss',
})
export class ColorPickerComponent {
  readonly control = input.required<FormControl<string>>();
  /** ID of an error message to link to the group. */
  readonly describedBy = input<string | null>(null);

  protected readonly palette = CATEGORY_PALETTE;
  protected readonly name = `category-color-${nextId++}`;
}
