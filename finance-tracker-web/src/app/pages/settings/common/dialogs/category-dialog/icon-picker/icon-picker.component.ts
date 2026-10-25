import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CATEGORY_ICONS } from '@styles/category-icons.constants';
import { CATEGORY_ICON_LABELS } from '../../../constants/category-icon-labels.constants';

/** Makes the radio group names unique per picker. */
let nextId = 0;

/**
 * Icon picker for a category (DESIGN.md "Settings → Categories": a grid of about 40 icons, the
 * fixed set). Native radio buttons sharing a `name` (the DOM attribute: the forms directive's
 * `name` input alone doesn't set it), so arrow keys move through the grid; each icon has a label.
 */
@Component({
  selector: 'app-icon-picker',
  imports: [MatIconModule, ReactiveFormsModule],
  template: `
    <fieldset class="picker" [attr.aria-describedby]="describedBy()">
      <legend class="label" i18n="@@settings.categories.field.icon">Icon</legend>
      <div class="grid">
        @for (icon of icons; track icon) {
          <label class="option" [title]="labels[icon]">
            <input
              type="radio"
              class="radio"
              [name]="name"
              [attr.name]="name"
              [value]="icon"
              [formControl]="control()"
              [attr.aria-label]="labels[icon]"
            />
            <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
          </label>
        }
      </div>
    </fieldset>
  `,
  styleUrl: './icon-picker.component.scss',
})
export class IconPickerComponent {
  readonly control = input.required<FormControl<string>>();
  /** ID of an error message to link to the group. */
  readonly describedBy = input<string | null>(null);

  protected readonly icons = CATEGORY_ICONS;
  protected readonly labels = CATEGORY_ICON_LABELS;
  protected readonly name = `category-icon-${nextId++}`;
}
