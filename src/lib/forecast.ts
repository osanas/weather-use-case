import { FORECAST_TTL_MS } from './weather/cache';
import type { DailySummary, HourlyPoint } from './weather/types';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Returns the calendar date (YYYY-MM-DD) of an instant in an IANA time zone.
 * Built from typed parts, so it never depends on a locale's output order.
 */
export function localDateString(instant: number | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: 'year' | 'month' | 'day') => {
    const value = parts.find(p => p.type === type)?.value;
    if (!value) throw new RangeError(`Missing ${type} for ${timeZone}`);
    return value;
  };
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Hourly points whose hour has not ended yet, starting with the in-progress hour. */
export function upcomingHours(hourly: readonly HourlyPoint[], now: number, count = 24): HourlyPoint[] {
  return hourly.filter(point => Date.parse(point.time) + HOUR_MS > now).slice(0, count);
}

/** Daily summaries starting at today's date in the city's time zone. */
export function nextDays(
  daily: readonly DailySummary[],
  timeZone: string,
  now: number,
  count = 5,
): DailySummary[] {
  const today = localDateString(now, timeZone);
  return daily.filter(day => day.date >= today).slice(0, count);
}

/** A forecast is expired once it is as old as the five-minute freshness target. */
export function isExpired(fetchedAt: string, now: number, ttlMs = FORECAST_TTL_MS): boolean {
  const fetched = Date.parse(fetchedAt);
  if (Number.isNaN(fetched)) return true;
  return now - fetched >= ttlMs;
}
