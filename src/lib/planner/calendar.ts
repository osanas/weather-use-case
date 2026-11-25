import type { DateBounds } from './form';
import { addCalendarDays } from './planner';

/**
 * Calendar arithmetic on local ISO dates (YYYY-MM-DD). Dates are civil dates in the city's
 * zone, so they are handled at UTC noon and never shift with the visitor's own zone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: string): [number, number, number] {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Invalid date "${date}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

const iso = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12)).toISOString().slice(0, 10);

/** Day of the week, 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Every date from `bounds.min` to `bounds.max`, inclusive. */
export function datesIn(bounds: DateBounds): string[] {
  const dates: string[] = [];
  // The cap keeps a malformed range finite; the planning horizon is seven days.
  for (let i = 0; i < 31; i++) {
    const date = addCalendarDays(bounds.min, i);
    if (date > bounds.max) break;
    dates.push(date);
  }
  return dates;
}

export const inBounds = (date: string, bounds: DateBounds) => date >= bounds.min && date <= bounds.max;

/** The first Saturday and Sunday on or after `bounds.min`, limited to the horizon. */
export function weekendDates(bounds: DateBounds): string[] {
  const dates = datesIn(bounds);
  const saturday = dates.findIndex(d => weekday(d) === 6);
  if (weekday(bounds.min) === 0) return [bounds.min];
  return saturday === -1 ? [] : dates.slice(saturday, saturday + 2);
}

/** Monday to Sunday of next week, limited to the horizon. */
export function nextWeekDates(bounds: DateBounds): string[] {
  const offset = ((8 - weekday(bounds.min)) % 7) || 7;
  const monday = addCalendarDays(bounds.min, offset);
  return datesIn(bounds).filter(d => d >= monday && d <= addCalendarDays(monday, 6));
}

/** Weeks (Sunday first) of the month containing `date`; days outside the month are `null`. */
export function monthGrid(date: string): (string | null)[][] {
  const [y, m] = parts(date);
  const first = iso(y, m, 1);
  const days = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const cells: (string | null)[] = Array(weekday(first)).fill(null);
  for (let d = 1; d <= days; d++) cells.push(iso(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** The same day in an adjacent month, clamped to that month's length. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0, 12)).getUTCDate();
  return iso(y, m + months, Math.min(d, lastDay));
}

export const monthLabel = (date: string) => {
  const [y, m] = parts(date);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(Date.UTC(y, m - 1, 15, 12));
};

export const longDayLabel = (date: string) => {
  const [y, m, d] = parts(date);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
    .format(Date.UTC(y, m - 1, d, 12));
};

export type CalendarKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

/** Keyboard movement in the date grid (WAI-ARIA date picker dialog), clamped to the horizon. */
export function moveDate(date: string, key: CalendarKey, bounds: DateBounds): string {
  const day = weekday(date);
  const next = {
    ArrowLeft: () => addCalendarDays(date, -1),
    ArrowRight: () => addCalendarDays(date, 1),
    ArrowUp: () => addCalendarDays(date, -7),
    ArrowDown: () => addCalendarDays(date, 7),
    Home: () => addCalendarDays(date, -day),
    End: () => addCalendarDays(date, 6 - day),
    PageUp: () => addMonths(date, -1),
    PageDown: () => addMonths(date, 1),
  }[key]();
  if (next < bounds.min) return bounds.min;
  if (next > bounds.max) return bounds.max;
  return next;
}
