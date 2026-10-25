/** Calendar dates and months as the API and URLs write them: "2026-10-19" and "2026-10". */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-19" for the local calendar date of `date`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" date, or null when the text is not a real date. */
export function parseIsoDate(text: string | null | undefined): Date | null {
  const match = ISO_DATE.exec(text ?? '');
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** "2026-10" for the month of `date`. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** First day of a "YYYY-MM" month, or null when the text is not a month. */
export function parseMonthKey(text: string | null | undefined): Date | null {
  const match = MONTH_KEY.exec(text ?? '');
  if (!match) {
    return null;
  }
  const [year, month] = match.slice(1).map(Number);
  return month >= 1 && month <= 12 ? new Date(year, month - 1, 1) : null;
}
