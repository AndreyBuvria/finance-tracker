import { Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { addDays, isSameDay } from '@common/date/day.utils';
import { controlState } from '../../../../utils/control-state.utils';

/**
 * Date with quick chips "Today" / "Yesterday" and a date picker (FEATURES.md F3). Dates up to
 * tomorrow are allowed (time-zone slack, as the API); later ones show "Date can't be in the future."
 */
@Component({
  selector: 'app-date-field',
  imports: [
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <mat-chip-listbox
      class="shortcuts"
      aria-label="Date shortcuts"
      i18n-aria-label="@@transactions.quickAdd.date.shortcuts"
    >
      <mat-chip-option
        [selected]="isToday()"
        (selectionChange)="onChip($event, today())"
        i18n="@@transactions.quickAdd.date.today"
        >Today</mat-chip-option
      >
      <mat-chip-option
        [selected]="isYesterday()"
        (selectionChange)="onChip($event, yesterday())"
        i18n="@@transactions.quickAdd.date.yesterday"
        >Yesterday</mat-chip-option
      >
    </mat-chip-listbox>
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.quickAdd.date">Date</mat-label>
      <input matInput [formControl]="control()" [matDatepicker]="picker" [max]="max()" />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker />
      @if (control().hasError('matDatepickerParse')) {
        <mat-error i18n="@@transactions.quickAdd.date.invalid">Enter a valid date.</mat-error>
      } @else if (control().hasError('required')) {
        <mat-error i18n="@@transactions.quickAdd.date.required">Choose a date.</mat-error>
      } @else if (control().hasError('matDatepickerMax')) {
        <mat-error i18n="@@transactions.quickAdd.date.future"
          >Date can't be in the future.</mat-error
        >
      } @else if (control().hasError('server')) {
        <mat-error>{{ control().getError('server') }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class DateFieldComponent {
  readonly control = input.required<FormControl<Date | null>>();
  /** Today in Europe/Warsaw (from `ClockService.businessToday()`). */
  readonly today = input.required<Date>();

  readonly yesterday = computed(() => addDays(this.today(), -1));
  /** Tomorrow: the API's latest allowed date. */
  readonly max = computed(() => addDays(this.today(), 1));

  private readonly state = controlState(this.control, null);
  readonly isToday = computed(() => isSameDay(this.state().value, this.today()));
  readonly isYesterday = computed(() => isSameDay(this.state().value, this.yesterday()));

  /** A chip sets its date; clicking the selected chip again keeps it selected. */
  onChip(change: MatChipSelectionChange, date: Date): void {
    if (change.selected) {
      this.pick(date);
    } else if (change.isUserInput) {
      change.source.select();
    }
  }

  pick(date: Date): void {
    const control = this.control();
    control.setValue(date);
    control.markAsDirty();
  }
}
