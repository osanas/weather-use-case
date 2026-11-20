import { describe, expect, it } from 'vitest';
import {
  describeWeatherCode,
  formatDay,
  formatHour,
  formatLocalTime,
  formatPercent,
  formatTemperature,
  formatWind,
  UNAVAILABLE,
} from './format';

const LAVAL_TZ = 'America/Toronto';
const hoursFrom = (startIso: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(startIso) + i * 3_600_000).toISOString());

describe('formatHour', () => {
  it('skips the missing local hour at the spring-forward transition (2027-03-14, Toronto)', () => {
    const labels = hoursFrom('2027-03-14T05:00:00Z', 4).map(t => formatHour(t, LAVAL_TZ));
    expect(labels).toEqual(['00:00 EST', '01:00 EST', '03:00 EDT', '04:00 EDT']);
    expect(labels.some(l => l.startsWith('02:'))).toBe(false);
  });

  it('labels the repeated local hour at the fall-back transition (2027-11-07, Toronto)', () => {
    const labels = hoursFrom('2027-11-07T04:00:00Z', 3).map(t => formatHour(t, LAVAL_TZ));
    expect(labels).toEqual(['00:00 EDT', '01:00 EDT', '01:00 EST']);
  });

  it('uses PST in winter and PDT in summer for Vancouver', () => {
    // Winter date is before British Columbia's March 2026 switch to permanent daylight
    // time, so every tzdata version agrees on PST. Later winters differ between runtimes.
    expect(formatHour('2026-01-15T20:00:00Z', 'America/Vancouver')).toBe('12:00 PST');
    expect(formatHour('2027-07-15T19:00:00Z', 'America/Vancouver')).toBe('12:00 PDT');
  });

  it('keeps Regina on CST all year', () => {
    expect(formatHour('2027-01-15T18:00:00Z', 'America/Regina')).toBe('12:00 CST');
    expect(formatHour('2027-07-15T18:00:00Z', 'America/Regina')).toBe('12:00 CST');
  });

  it("shows St. John's half-hour offset in NST and NDT", () => {
    expect(formatHour('2027-01-15T12:00:00Z', 'America/St_Johns')).toBe('08:30 NST');
    expect(formatHour('2027-07-15T12:00:00Z', 'America/St_Johns')).toBe('09:30 NDT');
  });

  it('shows missing instants as unavailable', () => {
    expect(formatHour(null, LAVAL_TZ)).toBe(UNAVAILABLE);
    expect(formatHour('bad', LAVAL_TZ)).toBe(UNAVAILABLE);
  });
});

describe('formatDay', () => {
  it('formats a local date without shifting it', () => {
    expect(formatDay('2027-01-15')).toBe('Fri, Jan 15');
    expect(formatDay('2027-07-15')).toBe('Thu, Jul 15');
    expect(formatDay('2027-03-05')).toBe('Fri, Mar 5');
  });

  it('rejects malformed dates', () => {
    expect(formatDay(null)).toBe(UNAVAILABLE);
    expect(formatDay('15/01/2027')).toBe(UNAVAILABLE);
  });
});

describe('formatPercent', () => {
  it('rounds and appends %', () => {
    expect(formatPercent(9.6)).toBe('10%');
    expect(formatPercent(null)).toBe(UNAVAILABLE);
  });
});

describe('formatLocalTime', () => {
  it('renders a winter instant in Laval standard time', () => {
    expect(formatLocalTime('2026-01-15T19:15:00Z', LAVAL_TZ)).toBe('Thu, Jan 15, 14:15 EST');
  });

  it('renders a summer instant in Laval daylight time', () => {
    expect(formatLocalTime('2027-06-14T12:00:00Z', LAVAL_TZ)).toBe('Mon, Jun 14, 08:00 EDT');
  });

  it('distinguishes the repeated local hour at the autumn DST transition', () => {
    expect(formatLocalTime('2026-11-01T05:30:00Z', LAVAL_TZ)).toBe('Sun, Nov 1, 01:30 EDT');
    expect(formatLocalTime('2026-11-01T06:30:00Z', LAVAL_TZ)).toBe('Sun, Nov 1, 01:30 EST');
  });

  it('uses the given zone, not the machine zone', () => {
    expect(formatLocalTime('2027-06-14T12:00:00Z', 'America/Vancouver')).toBe('Mon, Jun 14, 05:00 PDT');
  });

  it('shows missing or invalid instants as unavailable', () => {
    expect(formatLocalTime(null, LAVAL_TZ)).toBe(UNAVAILABLE);
    expect(formatLocalTime('not-a-date', LAVAL_TZ)).toBe(UNAVAILABLE);
  });
});

describe('formatTemperature', () => {
  it('rounds and appends °C', () => {
    expect(formatTemperature(18)).toBe('18 °C');
    expect(formatTemperature(-7.6)).toBe('-8 °C');
    expect(formatTemperature(-0.4)).toBe('0 °C');
  });

  it('shows a missing reading as unavailable', () => {
    expect(formatTemperature(null)).toBe(UNAVAILABLE);
  });
});

describe('formatWind and describeWeatherCode', () => {
  it('formats wind in km/h', () => {
    expect(formatWind(14.6)).toBe('15 km/h');
    expect(formatWind(null)).toBe(UNAVAILABLE);
  });

  it('labels known WMO codes and treats unknown or missing codes as unavailable', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(3)).toBe('Overcast');
    expect(describeWeatherCode(42)).toBe(UNAVAILABLE);
    expect(describeWeatherCode(null)).toBe(UNAVAILABLE);
  });
});
