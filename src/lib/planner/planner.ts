import { isExpired } from '@/lib/forecast';
import { FORECAST_DAYS } from '@/lib/weather/open-meteo';
import type { HourlyPoint, LocalDay } from '@/lib/weather/types';
import type { ActivityWindow, PlanCriteria, PlannerForecast, PlanResult } from './types';

const HOUR_MS = 60 * 60 * 1000;

/** Adds whole days to a YYYY-MM-DD date. Pure calendar arithmetic; no time zone involved. */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/**
 * Hour-start instants (epoch ms) of a local day, from its provider local-midnight bounds.
 * Steps are real elapsed hours, so a spring-forward day has 23 entries (the skipped local
 * hour never appears) and a fall-back day has 25 (the repeated local hour appears twice,
 * as two distinct instants). No time-zone rules are applied here.
 */
export function hourStartsOfDay(day: LocalDay): number[] {
  const start = Date.parse(day.startsAt);
  const end = Date.parse(day.endsAt);
  const hours: number[] = [];
  for (let t = start; t < end; t += HOUR_MS) hours.push(t);
  return hours;
}

type Assessment =
  | { status: 'pass'; window: ActivityWindow }
  | { status: 'fail' }
  | { status: 'unknown' };

/** Checks every hour against both inclusive maxima. A missing reading never passes. */
function assessWindow(
  hours: readonly number[],
  points: ReadonlyMap<number, HourlyPoint>,
  criteria: PlanCriteria,
): Assessment {
  let missing = false;
  let maxPrecipitationProbability = -Infinity;
  let maxWindKmh = -Infinity;
  for (const hour of hours) {
    const point = points.get(hour);
    const precipitation = point?.precipitationProbability ?? null;
    const wind = point?.windKmh ?? null;
    if (precipitation !== null && precipitation > criteria.maxPrecipitationProbability) return { status: 'fail' };
    if (wind !== null && wind > criteria.maxWindKmh) return { status: 'fail' };
    if (precipitation === null || wind === null) {
      missing = true;
      continue;
    }
    maxPrecipitationProbability = Math.max(maxPrecipitationProbability, precipitation);
    maxWindKmh = Math.max(maxWindKmh, wind);
  }
  if (missing) return { status: 'unknown' };
  return {
    status: 'pass',
    window: {
      start: new Date(hours[0]!).toISOString(),
      end: new Date(hours[hours.length - 1]! + HOUR_MS).toISOString(),
      maxPrecipitationProbability,
      maxWindKmh,
    },
  };
}

/** Lowest maximum precipitation, then lowest maximum wind, then earliest start. */
export function rankWindows(windows: readonly ActivityWindow[]): ActivityWindow[] {
  return [...windows].sort((a, b) =>
    a.maxPrecipitationProbability - b.maxPrecipitationProbability
    || a.maxWindKmh - b.maxWindKmh
    || Date.parse(a.start) - Date.parse(b.start));
}

/**
 * Finds the best activity window on the requested local day. Deterministic: the result
 * depends only on the forecast, the validated criteria and `now`.
 *
 * Local days come from the provider's local-midnight instants for the city's IANA zone,
 * so the planner never consults the server's own time-zone data.
 */
export function planActivityWindow(
  forecast: PlannerForecast,
  criteria: PlanCriteria,
  now: number,
): PlanResult {
  if (forecast.cityId !== criteria.cityId) {
    throw new Error('Forecast and criteria refer to different cities.');
  }
  if (isExpired(forecast.fetchedAt, now)) {
    return { outcome: 'insufficient', reason: 'stale', criteria };
  }

  const today = forecast.localDays.find(day =>
    Date.parse(day.startsAt) <= now && now < Date.parse(day.endsAt));
  if (!today) return { outcome: 'insufficient', reason: 'missing_data', criteria };
  if (criteria.date < today.date || criteria.date > addCalendarDays(today.date, FORECAST_DAYS - 1)) {
    return { outcome: 'outside_horizon', criteria };
  }

  const day = forecast.localDays.find(d => d.date === criteria.date);
  if (!day) return { outcome: 'insufficient', reason: 'missing_data', criteria };

  const points = new Map(forecast.hourly.map(point => [Date.parse(point.time), point]));
  const futureHours = hourStartsOfDay(day).filter(hour => hour >= now);

  const eligible: ActivityWindow[] = [];
  let unassessable = false;
  for (let i = 0; i + criteria.durationHours <= futureHours.length; i++) {
    const assessment = assessWindow(futureHours.slice(i, i + criteria.durationHours), points, criteria);
    if (assessment.status === 'pass') eligible.push(assessment.window);
    else if (assessment.status === 'unknown') unassessable = true;
  }

  const [best] = rankWindows(eligible);
  if (best) return { outcome: 'match', criteria, ...best };
  if (unassessable) return { outcome: 'insufficient', reason: 'missing_data', criteria };
  return { outcome: 'no_match', criteria };
}
