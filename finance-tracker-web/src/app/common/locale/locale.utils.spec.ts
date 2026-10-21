import { DatePipe } from '@angular/common';
import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { MONTH_FORMAT } from '../formatting/date-formats.constants';
import { provideAppLocale } from './locale.utils';

@Component({
  imports: [DatePipe],
  template: `<span class="day">{{ date | date }}</span
    ><span class="month">{{ date | date: monthFormat }}</span>`,
})
class Host {
  readonly date = new Date(2026, 9, 19);
  readonly monthFormat = MONTH_FORMAT;
}

describe('provideAppLocale', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAppLocale()] }));

  it('uses English as the UI locale', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('en-GB');
  });

  it('formats dates as "19 Oct 2026" by default and months as "October 2026"', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.day')?.textContent).toBe('19 Oct 2026');
    expect(el.querySelector('.month')?.textContent).toBe('October 2026');
  });

  it('starts weeks on Monday in Material date pickers', () => {
    expect(TestBed.inject(DateAdapter).getFirstDayOfWeek()).toBe(1);
  });
});
