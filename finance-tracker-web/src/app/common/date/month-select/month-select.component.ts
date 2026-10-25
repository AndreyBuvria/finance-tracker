import { DatePipe } from '@angular/common';
import { Component, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MONTH_FORMAT } from '@common/formatting/date-formats.constants';
import { addMonths } from '../month.utils';

/** "October 2026 ‹ ›" — shows a month and moves it one month back or forward. */
@Component({
  selector: 'app-month-select',
  imports: [DatePipe, MatButtonModule, MatIconModule],
  template: `
    <div class="month-select" role="group" aria-label="Month" i18n-aria-label="@@monthSelect.label">
      <span class="month" aria-live="polite">{{ month() | date: monthFormat }}</span>
      <button
        mat-icon-button
        type="button"
        aria-label="Previous month"
        i18n-aria-label="@@monthSelect.previous"
        (click)="move(-1)"
      >
        <mat-icon aria-hidden="true">chevron_left</mat-icon>
      </button>
      <button
        mat-icon-button
        type="button"
        aria-label="Next month"
        i18n-aria-label="@@monthSelect.next"
        (click)="move(1)"
      >
        <mat-icon aria-hidden="true">chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .month-select {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .month {
      min-width: 7.5em;
      font: var(--mat-sys-title-large);
    }
  `,
})
export class MonthSelectComponent {
  /** First day of the selected month. */
  readonly month = model.required<Date>();
  protected readonly monthFormat = MONTH_FORMAT;

  move(delta: number): void {
    this.month.update((month) => addMonths(month, delta));
  }
}
