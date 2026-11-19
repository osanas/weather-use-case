import { describe, expect, it } from 'vitest';
import {
  describeWeatherCode,
  formatLocalTime,
  formatTemperature,
  formatWind,
  UNAVAILABLE,
} from './format';

const LAVAL_TZ = 'America/Toronto';

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
