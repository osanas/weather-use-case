import { describe, expect, it } from 'vitest';
import type { HourlyPoint, LocalDay } from '@/lib/weather/types';
import { addCalendarDays, hourStartsOfDay, planActivityWindow, rankWindows } from './planner';
import type { PlanCriteria, PlannerForecast } from './types';

// Synthetic data only. Local days are given as provider local-midnight instants, so these
// tests do not depend on the runtime's time-zone database.

const HOUR_MS = 3_600_000;
type Reading = [precipitation: number | null, wind: number | null];

/** Toronto local days (EDT, UTC-4) starting on 2027-06-14. */
const summerDays = (count = 7): LocalDay[] => Array.from({ length: count }, (_, i) => {
  const start = Date.parse('2027-06-14T04:00:00Z') + i * 24 * HOUR_MS;
  return {
    date: addCalendarDays('2027-06-14', i),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 24 * HOUR_MS).toISOString(),
  };
});

/**
 * Hourly points for every hour of the given days. Hours default to `fallback` (failing
 * by default); `readings` overrides specific UTC hours; `omit` removes points entirely.
 */
function hourlyFor(
  days: readonly LocalDay[],
  readings: Record<string, Reading> = {},
  { fallback = [80, 40] as Reading, omit = [] as string[] } = {},
): HourlyPoint[] {
  const overrides = new Map(Object.entries(readings).map(([iso, r]) => [Date.parse(iso), r]));
  const omitted = new Set(omit.map(iso => Date.parse(iso)));
  return days.flatMap(hourStartsOfDay)
    .filter(t => !omitted.has(t))
    .map(t => {
      const [precipitationProbability, windKmh] = overrides.get(t) ?? fallback;
      return { time: new Date(t).toISOString(), temperatureC: 18, precipitationProbability, windKmh, weatherCode: 0 };
    });
}

const NOW = Date.parse('2027-06-14T12:00:00Z'); // 08:00 EDT in Laval

function forecast(
  readings: Record<string, Reading> = {},
  options: { omit?: string[]; days?: LocalDay[]; fetchedAt?: string; fallback?: Reading } = {},
): PlannerForecast {
  const days = options.days ?? summerDays();
  return {
    cityId: 'laval-qc',
    fetchedAt: options.fetchedAt ?? new Date(NOW).toISOString(),
    localDays: days,
    hourly: hourlyFor(days, readings, { fallback: options.fallback, omit: options.omit }),
  };
}

const criteria = (overrides: Partial<PlanCriteria> = {}): PlanCriteria => ({
  cityId: 'laval-qc',
  activity: 'hiking',
  date: '2027-06-14',
  durationHours: 2,
  maxPrecipitationProbability: 30,
  maxWindKmh: 25,
  ...overrides,
});

describe('planActivityWindow', () => {
  describe('valid window', () => {
    it('returns the eligible window with its start, end, maxima and the criteria used', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T15:00:00Z': [10, 12],
        '2027-06-14T16:00:00Z': [20, 18],
      }), criteria(), NOW);
      expect(result).toEqual({
        outcome: 'match',
        criteria: criteria(),
        start: '2027-06-14T15:00:00.000Z',
        end: '2027-06-14T17:00:00.000Z',
        maxPrecipitationProbability: 20,
        maxWindKmh: 18,
      });
    });

    it('treats both maxima as inclusive', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T15:00:00Z': [30, 25],
        '2027-06-14T16:00:00Z': [30, 25],
      }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'match', maxPrecipitationProbability: 30, maxWindKmh: 25 });
    });

    it('accepts a one-hour and a four-hour duration', () => {
      const good: Record<string, Reading> = {
        '2027-06-14T14:00:00Z': [0, 5], '2027-06-14T15:00:00Z': [0, 5],
        '2027-06-14T16:00:00Z': [0, 5], '2027-06-14T17:00:00Z': [0, 5],
      };
      expect(planActivityWindow(forecast(good), criteria({ durationHours: 1 }), NOW))
        .toMatchObject({ outcome: 'match', start: '2027-06-14T14:00:00.000Z', end: '2027-06-14T15:00:00.000Z' });
      expect(planActivityWindow(forecast(good), criteria({ durationHours: 4 }), NOW))
        .toMatchObject({ outcome: 'match', start: '2027-06-14T14:00:00.000Z', end: '2027-06-14T18:00:00.000Z' });
    });
  });

  describe('wind threshold', () => {
    it('rejects a two-hour period whose second hour exceeds the wind maximum (15 then 30 km/h for 25)', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [10, 15],
        '2027-06-14T14:00:00Z': [10, 30],
        '2027-06-14T15:00:00Z': [10, 12],
        '2027-06-14T16:00:00Z': [10, 11],
      }), criteria(), NOW);
      expect(result).toMatchObject({
        outcome: 'match', start: '2027-06-14T15:00:00.000Z', end: '2027-06-14T17:00:00.000Z', maxWindKmh: 12,
      });
    });

    it('reports no match when that period was the only candidate with acceptable rain', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [10, 15],
        '2027-06-14T14:00:00Z': [10, 30],
      }), criteria(), NOW);
      expect(result).toEqual({ outcome: 'no_match', criteria: criteria() });
    });
  });

  describe('no window available', () => {
    it('reports no match when the day is fully covered and every window fails', () => {
      expect(planActivityWindow(forecast(), criteria(), NOW)).toEqual({ outcome: 'no_match', criteria: criteria() });
    });

    it('reports no match when precipitation alone fails every window', () => {
      const result = planActivityWindow(forecast({}, { fallback: [31, 0] }), criteria(), NOW);
      expect(result.outcome).toBe('no_match');
    });

    it('reports no match when too few future hours remain in the day', () => {
      // 23:00 EDT: one hour left, four requested. The data covers the period.
      const late = Date.parse('2027-06-15T03:00:00Z');
      const result = planActivityWindow(
        forecast({}, { fallback: [0, 0], fetchedAt: new Date(late).toISOString() }),
        criteria({ durationHours: 4 }), late);
      expect(result.outcome).toBe('no_match');
    });
  });

  describe('missing observations', () => {
    it('reports insufficient data when the only otherwise eligible window has a missing reading', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [10, null],
        '2027-06-14T14:00:00Z': [10, 10],
      }), criteria(), NOW);
      expect(result).toEqual({ outcome: 'insufficient', reason: 'missing_data', criteria: criteria() });
    });

    it('treats a missing precipitation reading the same way', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [null, 10],
        '2027-06-14T14:00:00Z': [10, 10],
      }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
    });

    it('still returns a valid window found elsewhere in the day', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [0, null],
        '2027-06-14T14:00:00Z': [0, 0],
        '2027-06-14T18:00:00Z': [20, 20],
        '2027-06-14T19:00:00Z': [20, 20],
      }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T18:00:00.000Z' });
    });

    it('counts a window as failed when a known reading exceeds a maximum despite a missing one', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [null, 10],
        '2027-06-14T14:00:00Z': [10, 40],
      }), criteria(), NOW);
      expect(result.outcome).toBe('no_match');
    });

    it('treats an hour absent from the hourly series as missing readings', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [0, 0],
        '2027-06-14T15:00:00Z': [0, 0],
      }, { omit: ['2027-06-14T14:00:00Z'] }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
    });

    it('reports insufficient data when a date in the horizon has no provider day', () => {
      const result = planActivityWindow(
        forecast({}, { days: summerDays(3) }), criteria({ date: '2027-06-18' }), NOW);
      expect(result).toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
    });

    it('reports insufficient data when the forecast has no hourly points for the day', () => {
      const data = { ...forecast(), hourly: [] };
      expect(planActivityWindow(data, criteria(), NOW)).toMatchObject({ outcome: 'insufficient' });
    });

    it('reports insufficient data when no provider day contains the current instant', () => {
      const data = forecast({}, { days: summerDays(7).slice(1) });
      expect(planActivityWindow(data, criteria({ date: '2027-06-15' }), NOW))
        .toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
    });
  });

  describe('stale data', () => {
    const good = { '2027-06-14T15:00:00Z': [0, 0], '2027-06-14T16:00:00Z': [0, 0] } satisfies Record<string, Reading>;

    it('reports insufficient data once the forecast is five minutes old', () => {
      const fetchedAt = new Date(NOW - 5 * 60_000).toISOString();
      expect(planActivityWindow(forecast(good, { fetchedAt }), criteria(), NOW))
        .toEqual({ outcome: 'insufficient', reason: 'stale', criteria: criteria() });
    });

    it('still plans just before the freshness limit', () => {
      const fetchedAt = new Date(NOW - 5 * 60_000 + 1).toISOString();
      expect(planActivityWindow(forecast(good, { fetchedAt }), criteria(), NOW).outcome).toBe('match');
    });
  });

  describe('forecast horizon', () => {
    it('rejects a date before today in the city', () => {
      expect(planActivityWindow(forecast(), criteria({ date: '2027-06-13' }), NOW).outcome).toBe('outside_horizon');
    });

    it('accepts today + 6 days and rejects today + 7', () => {
      const lastDay = { '2027-06-20T15:00:00Z': [0, 0], '2027-06-20T16:00:00Z': [0, 0] } satisfies Record<string, Reading>;
      expect(planActivityWindow(forecast(lastDay), criteria({ date: '2027-06-20' }), NOW).outcome).toBe('match');
      expect(planActivityWindow(forecast(), criteria({ date: '2027-06-21' }), NOW).outcome).toBe('outside_horizon');
    });
  });

  describe('future hours only', () => {
    const good: Record<string, Reading> = {
      '2027-06-14T13:00:00Z': [0, 0], '2027-06-14T14:00:00Z': [0, 0], '2027-06-14T15:00:00Z': [5, 5],
    };

    it('excludes the hour in progress', () => {
      const now = Date.parse('2027-06-14T13:30:00Z');
      const result = planActivityWindow(forecast(good, { fetchedAt: new Date(now).toISOString() }), criteria(), now);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T14:00:00.000Z' });
    });

    it('accepts a window that starts exactly now', () => {
      const now = Date.parse('2027-06-14T13:00:00Z');
      const result = planActivityWindow(forecast(good, { fetchedAt: new Date(now).toISOString() }), criteria(), now);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T13:00:00.000Z' });
    });

    it('ignores a better window that has already started or passed', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T10:00:00Z': [0, 0], '2027-06-14T11:00:00Z': [0, 0],
        '2027-06-14T20:00:00Z': [25, 20], '2027-06-14T21:00:00Z': [25, 20],
      }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T20:00:00.000Z' });
    });
  });

  describe('ranking', () => {
    it('prefers lower maximum precipitation, then lower maximum wind, then the earliest start', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [20, 5],
        '2027-06-14T15:00:00Z': [10, 20],
        '2027-06-14T18:00:00Z': [10, 10],
        '2027-06-14T20:00:00Z': [10, 10],
      }), criteria({ durationHours: 1 }), NOW);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T18:00:00.000Z' });
    });

    it('ranks by the worst hour of each window, not its average', () => {
      const result = planActivityWindow(forecast({
        '2027-06-14T13:00:00Z': [0, 0], '2027-06-14T14:00:00Z': [25, 0],
        '2027-06-14T17:00:00Z': [15, 0], '2027-06-14T18:00:00Z': [15, 0],
      }), criteria(), NOW);
      expect(result).toMatchObject({ outcome: 'match', start: '2027-06-14T17:00:00.000Z', maxPrecipitationProbability: 15 });
    });

    it('sorts windows deterministically', () => {
      const w = (start: string, p: number, wind: number) => ({ start, end: start, maxPrecipitationProbability: p, maxWindKmh: wind });
      const ranked = rankWindows([
        w('2027-06-14T20:00:00.000Z', 10, 10), w('2027-06-14T13:00:00.000Z', 20, 5),
        w('2027-06-14T18:00:00.000Z', 10, 10), w('2027-06-14T15:00:00.000Z', 10, 20),
      ]);
      expect(ranked.map(x => x.start)).toEqual([
        '2027-06-14T18:00:00.000Z', '2027-06-14T20:00:00.000Z', '2027-06-14T15:00:00.000Z', '2027-06-14T13:00:00.000Z',
      ]);
    });
  });

  describe('daylight-saving transitions (America/Toronto, provider midnights)', () => {
    it('spring forward: 23 hours, the skipped 02:00 never appears, 01:00 EST → 03:00 EDT is two hours', () => {
      const day: LocalDay = { date: '2027-03-14', startsAt: '2027-03-14T05:00:00.000Z', endsAt: '2027-03-15T04:00:00.000Z' };
      expect(hourStartsOfDay(day)).toHaveLength(23);
      const now = Date.parse('2027-03-14T05:00:00Z');
      const data = forecast({
        '2027-03-14T06:00:00Z': [0, 0], // 01:00 EST
        '2027-03-14T07:00:00Z': [0, 0], // 03:00 EDT
      }, { days: [day], fetchedAt: new Date(now).toISOString() });
      const result = planActivityWindow(data, criteria({ date: '2027-03-14' }), now);
      expect(result).toMatchObject({
        outcome: 'match', start: '2027-03-14T06:00:00.000Z', end: '2027-03-14T08:00:00.000Z',
      });
    });

    it('fall back: 25 hours, both 01:00 hours are distinct and a window can span them', () => {
      const day: LocalDay = { date: '2027-11-07', startsAt: '2027-11-07T04:00:00.000Z', endsAt: '2027-11-08T05:00:00.000Z' };
      expect(hourStartsOfDay(day)).toHaveLength(25);
      const now = Date.parse('2027-11-07T04:00:00Z');
      const data = forecast({
        '2027-11-07T05:00:00Z': [0, 0], // 01:00 EDT
        '2027-11-07T06:00:00Z': [0, 0], // 01:00 EST (repeated local hour)
      }, { days: [day], fetchedAt: new Date(now).toISOString() });
      const result = planActivityWindow(data, criteria({ date: '2027-11-07' }), now);
      expect(result).toMatchObject({
        outcome: 'match', start: '2027-11-07T05:00:00.000Z', end: '2027-11-07T07:00:00.000Z',
      });
    });

    it('includes the last hour of a 25-hour day', () => {
      const day: LocalDay = { date: '2027-11-07', startsAt: '2027-11-07T04:00:00.000Z', endsAt: '2027-11-08T05:00:00.000Z' };
      const now = Date.parse('2027-11-07T04:00:00Z');
      const data = forecast({ '2027-11-08T04:00:00Z': [0, 0] }, { days: [day], fetchedAt: new Date(now).toISOString() });
      expect(planActivityWindow(data, criteria({ date: '2027-11-07', durationHours: 1 }), now))
        .toMatchObject({ outcome: 'match', start: '2027-11-08T04:00:00.000Z', end: '2027-11-08T05:00:00.000Z' });
    });
  });

  describe('Vancouver after British Columbia moved to UTC-7 year-round', () => {
    // Provider midnights at 07:00Z in November 2026. Node 24.12 (tz 2025b) would apply
    // PST (UTC-8) and file 07:00Z under the previous date; the planner must not.
    const days: LocalDay[] = Array.from({ length: 7 }, (_, i) => {
      const start = Date.parse('2026-11-19T07:00:00Z') + i * 24 * HOUR_MS;
      return {
        date: addCalendarDays('2026-11-19', i),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(start + 24 * HOUR_MS).toISOString(),
      };
    });
    const now = Date.parse('2026-11-19T18:00:00Z');
    const vancouver = (readings: Record<string, Reading>): PlannerForecast => ({
      ...forecast(readings, { days, fetchedAt: new Date(now).toISOString() }),
      cityId: 'vancouver-bc',
    });

    it('uses the provider day: local 00:00 is 07:00Z and belongs to the requested date', () => {
      const result = planActivityWindow(
        vancouver({ '2026-11-20T07:00:00Z': [0, 0] }),
        criteria({ cityId: 'vancouver-bc', date: '2026-11-20', durationHours: 1 }), now);
      expect(result).toMatchObject({
        outcome: 'match', start: '2026-11-20T07:00:00.000Z', end: '2026-11-20T08:00:00.000Z',
      });
    });

    it("does not take the next day's 00:00 (07:00Z) as the requested day's last hour", () => {
      const result = planActivityWindow(
        vancouver({ '2026-11-21T07:00:00Z': [0, 0] }),
        criteria({ cityId: 'vancouver-bc', date: '2026-11-20', durationHours: 1 }), now);
      expect(result.outcome).toBe('no_match');
    });
  });

  it("supports a half-hour offset grid (St. John's) without zone-specific code", () => {
    const day: LocalDay = { date: '2027-06-14', startsAt: '2027-06-14T02:30:00.000Z', endsAt: '2027-06-15T02:30:00.000Z' };
    const now = Date.parse('2027-06-14T12:00:00Z');
    const data: PlannerForecast = {
      ...forecast({ '2027-06-14T14:30:00Z': [0, 0] }, { days: [day] }),
      cityId: 'st-johns-nl',
    };
    expect(planActivityWindow(data, criteria({ cityId: 'st-johns-nl', durationHours: 1 }), now))
      .toMatchObject({ outcome: 'match', start: '2027-06-14T14:30:00.000Z' });
  });

  it('refuses a forecast for a different city', () => {
    expect(() => planActivityWindow(forecast(), criteria({ cityId: 'toronto-on' }), NOW)).toThrow();
  });

  it('is deterministic for the same inputs', () => {
    const data = forecast({ '2027-06-14T15:00:00Z': [0, 0], '2027-06-14T16:00:00Z': [0, 0] });
    expect(planActivityWindow(data, criteria(), NOW)).toEqual(planActivityWindow(data, criteria(), NOW));
  });
});

describe('addCalendarDays', () => {
  it('crosses month and year ends without a time zone', () => {
    expect(addCalendarDays('2027-06-30', 1)).toBe('2027-07-01');
    expect(addCalendarDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2027-06-14', 6)).toBe('2027-06-20');
  });
});
