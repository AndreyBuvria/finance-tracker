import { EnvironmentProviders, Injectable, makeEnvironmentProviders } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

/** Material datepicker labels from the app's i18n files (all UI text is translatable). */
@Injectable({ providedIn: 'root' })
export class LocalizedDatepickerIntl extends MatDatepickerIntl {
  override calendarLabel = $localize`:@@datepicker.calendar:Calendar`;
  override openCalendarLabel = $localize`:@@datepicker.open:Open calendar`;
  override closeCalendarLabel = $localize`:@@datepicker.close:Close calendar`;
  override prevMonthLabel = $localize`:@@datepicker.prevMonth:Previous month`;
  override nextMonthLabel = $localize`:@@datepicker.nextMonth:Next month`;
  override prevYearLabel = $localize`:@@datepicker.prevYear:Previous year`;
  override nextYearLabel = $localize`:@@datepicker.nextYear:Next year`;
  override prevMultiYearLabel = $localize`:@@datepicker.prevYears:Previous 24 years`;
  override nextMultiYearLabel = $localize`:@@datepicker.nextYears:Next 24 years`;
  override switchToMonthViewLabel = $localize`:@@datepicker.chooseDate:Choose date`;
  override switchToMultiYearViewLabel = $localize`:@@datepicker.chooseMonthYear:Choose month and year`;
  override startDateLabel = $localize`:@@datepicker.startDate:Start date`;
  override endDateLabel = $localize`:@@datepicker.endDate:End date`;
  override comparisonDateLabel = $localize`:@@datepicker.comparisonRange:Comparison range`;

  override formatYearRange(start: string, end: string): string {
    return `${start} – ${end}`;
  }

  override formatYearRangeLabel(start: string, end: string): string {
    return $localize`:@@datepicker.yearRange:${start}:start: to ${end}:end:`;
  }
}

/**
 * Translatable datepicker labels. Add to the providers of each lazy route that shows a datepicker
 * (not app-wide: importing the datepicker would put it in the initial bundle).
 */
export function provideLocalizedDatepickerIntl(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MatDatepickerIntl, useExisting: LocalizedDatepickerIntl },
  ]);
}
