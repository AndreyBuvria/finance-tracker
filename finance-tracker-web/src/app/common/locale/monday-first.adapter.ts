import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** Native date adapter with weeks starting on Monday, regardless of browser locale data. */
@Injectable({ providedIn: 'root' })
export class MondayFirstAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
}
