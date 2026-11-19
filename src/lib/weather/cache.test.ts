import { describe, expect, it } from 'vitest';
import { createForecastCache, FORECAST_TTL_MS } from './cache';
import type { WeatherResponse } from './types';

function forecast(cityId: string): WeatherResponse {
  return {
    cityId,
    timezone: 'America/Toronto',
    fetchedAt: '2027-06-14T12:00:00.000Z',
    current: { time: '2027-06-14T12:00:00.000Z', temperatureC: 18, windKmh: 15, weatherCode: 0 },
  };
}

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('createForecastCache', () => {
  it('uses a five-minute freshness target', () => {
    expect(FORECAST_TTL_MS).toBe(300_000);
  });

  it('returns a stored forecast before it expires', () => {
    const clock = fakeClock();
    const cache = createForecastCache({ now: clock.now });
    cache.set('laval-qc', forecast('laval-qc'));
    clock.advance(FORECAST_TTL_MS - 1);
    expect(cache.get('laval-qc')).toEqual(forecast('laval-qc'));
  });

  it('treats an entry as a miss at exactly the TTL', () => {
    const clock = fakeClock();
    const cache = createForecastCache({ now: clock.now });
    cache.set('laval-qc', forecast('laval-qc'));
    clock.advance(FORECAST_TTL_MS);
    expect(cache.get('laval-qc')).toBeUndefined();
  });

  it('keeps cities separate', () => {
    const cache = createForecastCache({ now: fakeClock().now });
    cache.set('laval-qc', forecast('laval-qc'));
    expect(cache.get('montreal-qc')).toBeUndefined();
    expect(cache.get('laval-qc')?.cityId).toBe('laval-qc');
  });
});
