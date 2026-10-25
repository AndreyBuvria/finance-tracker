import { formatDate } from '@angular/common';
import { DATE_FORMAT } from '@common/formatting/date-formats.constants';
import { Transaction } from '@common/transactions/transaction.model';
import { transactionTitle } from './transaction-display.utils';

/** Accessible name of a row's checkbox: "Select Żabka, 19 Oct 2026". */
export function selectRowLabel(transaction: Transaction, locale: string): string {
  const title = transactionTitle(transaction);
  const date = formatDate(transaction.date, DATE_FORMAT, locale);
  return $localize`:@@transactions.select.row:Select ${title}:title:, ${date}:date:`;
}

/**
 * Accessible name of a row's title button, which opens the edit dialog: "Edit Żabka, 19 Oct 2026".
 * It contains the visible title (WCAG 2.5.3 "Label in Name").
 */
export function editRowLabel(transaction: Transaction, locale: string): string {
  const title = transactionTitle(transaction);
  const date = formatDate(transaction.date, DATE_FORMAT, locale);
  return $localize`:@@transactions.edit.row:Edit ${title}:title:, ${date}:date:`;
}

/** Controls inside a row that do their own thing, so a click on them doesn't open the row. */
const ROW_CONTROLS = 'button, a, input, label, mat-checkbox, [tabindex]';

/** Whether a click on a row (`currentTarget`) came from one of the row's own controls. */
export function isFromControl(event: Event): boolean {
  const row = event.currentTarget;
  const control = event.target instanceof Element ? event.target.closest(ROW_CONTROLS) : null;
  return !!control && control !== row && row instanceof Node && row.contains(control);
}
