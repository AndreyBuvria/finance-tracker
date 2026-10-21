import { DATE_PIPE_DEFAULT_OPTIONS, registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localePl from '@angular/common/locales/pl';
import {
  EnvironmentProviders,
  Injectable,
  LOCALE_ID,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MAT_NATIVE_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';
import { DATE_FORMAT } from '../formatting/date-formats';

/**
 * UI language: English (en-GB gives "19 Oct 2026" and Monday-first weeks).
 * Money: always Polish formatting ("1 234,56 zł"), see `common/formatting/money.utils.ts`.
 */
export const UI_LOCALE = 'en-GB';
export const MONEY_LOCALE = 'pl';

registerLocaleData(localeEnGb, UI_LOCALE);
registerLocaleData(localePl, MONEY_LOCALE);

/** Native date adapter with weeks starting on Monday, regardless of browser locale data. */
@Injectable({ providedIn: 'root' })
export class MondayFirstDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
}

export function provideAppLocale(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: LOCALE_ID, useValue: UI_LOCALE },
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { dateFormat: DATE_FORMAT } },
    { provide: MAT_DATE_LOCALE, useValue: UI_LOCALE },
    { provide: DateAdapter, useClass: MondayFirstDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ]);
}
