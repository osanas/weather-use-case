import { dataDomain, finite, type Domain } from './forecast-chart';
import type { HourlyPoint } from './weather/types';

/**
 * Pure helpers for the weather widget's curve. The widget only draws: planner windows and
 * limits arrive as given (WEA-18) and are never scored here.
 */

// One formatter per zone: building Intl formatters is the costly part of grouping hours.
const localFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local calendar date (YYYY-MM-DD) and hour (0–23) of a UTC instant in the city's zone. */
export function localParts(isoUtc: string, timeZone: string): { date: string; hour: number } | null {
  const instant = Date.parse(isoUtc);
  if (Number.isNaN(instant)) return null;
  let formatter = localFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
    });
    localFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

/**
 * Hourly points whose start falls on this local date. A local day has 23, 24 or 25 hours
 * across daylight-saving changes; grouping by instant keeps each one.
 */
export function hoursOn(hourly: readonly HourlyPoint[], date: string, timeZone: string): HourlyPoint[] {
  return hourly.filter(hour => localParts(hour.time, timeZone)?.date === date);
}

/** Whether an hour starting at `hourStart` lies in the window: `start` inclusive, `end` exclusive. */
function inWindow(hourStart: string, start: string, end: string): boolean {
  const t = Date.parse(hourStart);
  return t >= Date.parse(start) && t < Date.parse(end);
}

export type Metric = 'temperature' | 'precipitation' | 'wind';
export const METRICS: readonly Metric[] = ['temperature', 'precipitation', 'wind'];

/** A planner window, ISO 8601 UTC: `start` inclusive, `end` exclusive. */
export type PlanWindow = { start: string; end: string; active: boolean };
export type PlanLimits = { maxPrecipitationProbability: number; maxWindKmh: number };

/** Wind curves never scale below this, so a calm day does not look stormy. */
export const MIN_WIND_SCALE_KMH = 10;

export function metricValues(hours: readonly HourlyPoint[], metric: Metric): (number | null)[] {
  return hours.map(hour => {
    if (metric === 'temperature') return hour.temperatureC;
    if (metric === 'precipitation') return hour.precipitationProbability;
    return hour.windKmh;
  });
}

/** The planner limit drawn on a curve: precipitation and wind only. */
export function limitFor(metric: Metric, limits: PlanLimits | undefined): number | null {
  if (!limits) return null;
  if (metric === 'precipitation') return finite(limits.maxPrecipitationProbability) ? limits.maxPrecipitationProbability : null;
  if (metric === 'wind') return finite(limits.maxWindKmh) ? limits.maxWindKmh : null;
  return null;
}

/**
 * Vertical range of a curve: the day's own range for temperature, 0–100 % for precipitation,
 * and zero to the highest of the day's wind, the limit and a calm minimum for wind.
 */
export function metricDomain(values: readonly (number | null)[], metric: Metric, limit: number | null = null): Domain | null {
  if (metric === 'temperature') return dataDomain(values);
  if (metric === 'precipitation') return { min: 0, max: 100 };
  const known = values.filter(finite);
  return { min: 0, max: Math.max(MIN_WIND_SCALE_KMH, ...known, limit ?? 0) };
}

/** Highest known value, or `null`. */
export function maxValue(values: readonly (number | null)[]): number | null {
  return dataDomain(values)?.max ?? null;
}

export type HourMark = { index: number; hour: number; label: string };

/**
 * Columns whose local hour is a multiple of three, labelled "00:00", "03:00"… in the city's
 * zone. On daylight-saving days the 23 or 25 hourly points keep their own local hours.
 */
export function threeHourMarks(hours: readonly HourlyPoint[], timeZone: string): HourMark[] {
  return hours.flatMap((hour, index) => {
    const local = localParts(hour.time, timeZone)?.hour;
    if (local === undefined || !Number.isInteger(local) || local % 3 !== 0) return [];
    return [{ index, hour: local, label: `${String(local).padStart(2, '0')}:00` }];
  });
}

export type WindowSpan = { from: number; to: number; active: boolean };

/**
 * Column runs covered by each window, `to` exclusive. An hour belongs to a window when it
 * starts inside it. Active windows come last, so their outline is drawn on top.
 */
export function windowSpans(hours: readonly HourlyPoint[], windows: readonly PlanWindow[]): WindowSpan[] {
  const spans: WindowSpan[] = [];
  for (const window of windows) {
    let from = -1;
    hours.forEach((hour, i) => {
      const inside = inWindow(hour.time, window.start, window.end);
      if (inside && from === -1) from = i;
      if (!inside && from !== -1) {
        spans.push({ from, to: i, active: window.active });
        from = -1;
      }
    });
    if (from !== -1) spans.push({ from, to: hours.length, active: window.active });
  }
  return spans.sort((a, b) => Number(a.active) - Number(b.active));
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Weekday of a local calendar date (YYYY-MM-DD), e.g. "Fri" or "Friday". The date is already
 * local to the city, so it is read at UTC noon in UTC. Unparseable dates give an empty string.
 */
export function weekdayOf(date: string, style: 'short' | 'long'): string {
  const match = ISO_DATE.exec(date);
  if (!match) return '';
  const instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(instant)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', weekday: style }).format(instant);
}

/** Short value printed above the curve: "-8°", "40%" or "24" (km/h). Empty when missing. */
export function compactValue(value: number | null, metric: Metric): string {
  if (!finite(value)) return '';
  const rounded = Math.round(value) || 0;
  if (metric === 'temperature') return `${rounded}°`;
  if (metric === 'precipitation') return `${Math.min(100, Math.max(0, rounded))}%`;
  return String(rounded);
}
