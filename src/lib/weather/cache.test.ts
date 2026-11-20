import { describe, expect, it } from 'vitest';
import { createForecastCache, FORECAST_TTL_MS } from './cache';
import { syntheticProviderForecast } from './test-fixtures';

const forecast = (cityId: string) => syntheticProviderForecast({ cityId });

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('createForecastCache', () => {
  it('uses a five-minute freshness target', () => {
    expect(FORECAST_TTL_MS).toBe(300_000);
  });

  it('returns the whole stored forecast, including hourly and daily data, before it expires', () => {
    const clock = fakeClock();
    const cache = createForecastCache({ now: clock.now });
    cache.set('laval-qc', forecast('laval-qc'));
    clock.advance(FORECAST_TTL_MS - 1);
    const hit = cache.get('laval-qc');
    expect(hit).toEqual(forecast('laval-qc'));
    expect(hit?.hourly).toHaveLength(2);
    expect(hit?.daily).toHaveLength(2);
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
