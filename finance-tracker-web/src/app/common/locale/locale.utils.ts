import { DATE_PIPE_DEFAULT_OPTIONS, registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localePl from '@angular/common/locales/pl';
import { EnvironmentProviders, LOCALE_ID, makeEnvironmentProviders } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MAT_NATIVE_DATE_FORMATS,
} from '@angular/material/core';
import { DATE_FORMAT } from '../formatting/date-formats.constants';
import { MONEY_LOCALE, UI_LOCALE } from './locale.constants';
import { MondayFirstAdapter } from './monday-first.adapter';

registerLocaleData(localeEnGb, UI_LOCALE);
registerLocaleData(localePl, MONEY_LOCALE);

/**
 * UI locale (en-GB), default date format, Monday-first Material date adapter. Routes with a
 * datepicker also add `provideLocalizedDatepickerIntl()` (kept out of here: importing the datepicker
 * would put it in the initial bundle).
 */
export function provideAppLocale(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: LOCALE_ID, useValue: UI_LOCALE },
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { dateFormat: DATE_FORMAT } },
    { provide: MAT_DATE_LOCALE, useValue: UI_LOCALE },
    { provide: DateAdapter, useClass: MondayFirstAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ]);
}
