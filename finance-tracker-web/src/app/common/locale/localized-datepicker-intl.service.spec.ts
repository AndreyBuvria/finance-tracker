import { TestBed } from '@angular/core/testing';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { provideLocalizedDatepickerIntl } from './localized-datepicker-intl.service';

describe('provideLocalizedDatepickerIntl', () => {
  it('takes the datepicker labels from the i18n files', () => {
    TestBed.configureTestingModule({ providers: [provideLocalizedDatepickerIntl()] });
    const intl = TestBed.inject(MatDatepickerIntl);
    expect(intl.openCalendarLabel).toBe('Open calendar');
    expect(intl.formatYearRange('2024', '2047')).toBe('2024 – 2047');
    expect(intl.formatYearRangeLabel('2024', '2047')).toBe('2024 to 2047');
  });
});
