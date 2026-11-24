import { describe, expect, it } from 'vitest';
import { syntheticForecast } from '@/lib/weather/test-fixtures';
import type { CurrentConditions } from '@/lib/weather/types';
import { isNight, sceneFor, sceneKey, skyForCode } from './scene';

// Fixed clock: the synthetic forecast was fetched at 12:00 UTC (08:00 in Toronto).
const FETCHED = '2027-06-14T12:00:00.000Z';
const NOW = Date.parse('2027-06-14T12:02:00Z');

const forecast = (current: Partial<CurrentConditions> = {}, fetchedAt = FETCHED) => {
  const base = syntheticForecast({ cityId: 'montreal-qc', fetchedAt });
  return { ...base, current: { ...base.current, ...current } };
};

describe('skyForCode', () => {
  it.each([
    [[0, 1], 'clear'],
    [[2, 3], 'cloudy'],
    [[45, 48], 'fog'],
    [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'rain'],
    [[71, 73, 75, 77, 85, 86], 'snow'],
    [[95, 96, 99], 'storm'],
  ] as const)('maps WMO codes %j to %s', (codes, sky) => {
    for (const code of codes) expect(skyForCode(code)).toBe(sky);
  });

  it('returns null for missing or unknown codes', () => {
    for (const code of [null, 4, 50, 100, -1]) expect(skyForCode(code)).toBeNull();
  });
});

describe('isNight', () => {
  it('uses the provider day/night flag first', () => {
    expect(isNight(forecast({ isDay: true }))).toBe(false);
    expect(isNight(forecast({ isDay: false }))).toBe(true);
  });

  it('falls back to the observation hour in the city zone when the flag is missing', () => {
    // 08:00 EDT is day; 01:00 EDT (05:00 UTC) and 21:00 EDT (01:00 UTC next day) are night.
    expect(isNight(forecast({ isDay: null }))).toBe(false);
    expect(isNight(forecast({ isDay: null, time: '2027-06-14T05:00:00Z' }))).toBe(true);
    expect(isNight(forecast({ isDay: null, time: '2027-06-15T01:00:00Z' }))).toBe(true);
    // 06:00 EDT is the first daylight hour, 19:59 the last.
    expect(isNight(forecast({ isDay: null, time: '2027-06-14T10:00:00Z' }))).toBe(false);
    expect(isNight(forecast({ isDay: null, time: '2027-06-14T23:59:00Z' }))).toBe(false);
    expect(isNight(forecast({ isDay: null, time: '2027-06-15T00:00:00Z' }))).toBe(true);
  });

  it('uses the fetch time when the observation time is missing, and day if nothing parses', () => {
    expect(isNight(forecast({ isDay: null, time: null }, '2027-06-14T03:00:00Z'))).toBe(true);
    expect(isNight({ ...forecast({ isDay: null, time: 'soon' }), fetchedAt: 'never' })).toBe(false);
  });
});

describe('sceneFor', () => {
  it('derives sky, night and cold from current conditions', () => {
    expect(sceneFor(forecast({ weatherCode: 61, isDay: true, temperatureC: 4 }), NOW))
      .toEqual({ sky: 'rain', night: false, cold: false });
    expect(sceneFor(forecast({ weatherCode: 73, isDay: false, temperatureC: -6 }), NOW))
      .toEqual({ sky: 'snow', night: true, cold: true });
  });

  it('counts exactly 0 °C as cold and a missing temperature as not cold', () => {
    expect(sceneFor(forecast({ temperatureC: 0 }), NOW)?.cold).toBe(true);
    expect(sceneFor(forecast({ temperatureC: 0.4 }), NOW)?.cold).toBe(false);
    expect(sceneFor(forecast({ temperatureC: null }), NOW)?.cold).toBe(false);
  });

  it('shows the neutral world for no data, an unknown code or an expired forecast', () => {
    expect(sceneFor(null, NOW)).toBeNull();
    expect(sceneFor(forecast({ weatherCode: null }), NOW)).toBeNull();
    expect(sceneFor(forecast({ weatherCode: 4 }), NOW)).toBeNull();
    // The five-minute freshness target: 4:59 old is still current, 5:00 is expired.
    expect(sceneFor(forecast(), Date.parse(FETCHED) + 299_000)).not.toBeNull();
    expect(sceneFor(forecast(), Date.parse(FETCHED) + 300_000)).toBeNull();
    expect(sceneFor(forecast({}, 'not a date'), NOW)).toBeNull();
  });
});

describe('sceneKey', () => {
  it('names the scene for CSS', () => {
    expect(sceneKey(null)).toBe('calm');
    expect(sceneKey({ sky: 'clear', night: false, cold: false })).toBe('clear-day');
    expect(sceneKey({ sky: 'storm', night: true, cold: true })).toBe('storm-night');
  });
});
