import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_ERROR, loadForecast, toWeatherResponse } from './client';
import { syntheticForecast } from './test-fixtures';

const valid = syntheticForecast();

describe('toWeatherResponse', () => {
  it('accepts a valid body', () => {
    expect(toWeatherResponse(valid, 'laval-qc')).toEqual(valid);
  });

  it('treats missing optional readings as null', () => {
    const body = {
      ...valid,
      hourly: [{ time: '2027-06-14T12:00:00Z', temperatureC: 18, windKmh: 15 }],
      daily: [{ date: '2027-06-14', minC: 12, maxC: 20 }],
    };
    const result = toWeatherResponse(body, 'laval-qc');
    expect(result?.hourly[0]).toEqual({
      time: '2027-06-14T12:00:00Z', temperatureC: 18, precipitationProbability: null, windKmh: 15, weatherCode: null,
    });
    expect(result?.daily[0]).toEqual({
      date: '2027-06-14', minC: 12, maxC: 20, precipitationProbability: null, weatherCode: null,
    });
  });

  it('keeps a boolean isDay and treats anything else as unknown', () => {
    const withIsDay = (isDay: unknown) =>
      toWeatherResponse({ ...valid, current: { ...valid.current, isDay } }, 'laval-qc')?.current.isDay;
    expect(withIsDay(false)).toBe(false);
    expect(withIsDay(1)).toBeNull();
    expect(withIsDay(undefined)).toBeNull();
  });

  it.each([
    ['a different city', { ...valid, cityId: 'montreal-qc' }],
    ['a non-array hourly', { ...valid, hourly: {} }],
    ['missing daily', { ...valid, daily: undefined }],
    ['an hourly entry without time', { ...valid, hourly: [{ temperatureC: 1 }] }],
    ['a daily entry with a bad date', { ...valid, daily: [{ date: '15/01/2027' }] }],
    ['a non-object body', 'nope'],
  ])('rejects %s', (_name, body) => {
    expect(toWeatherResponse(body, 'laval-qc')).toBeNull();
  });
});

describe('loadForecast', () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('requests the same-origin API with the catalogue ID', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(valid));
    expect(await loadForecast('laval-qc', undefined, fetchImpl)).toEqual({ ok: true, data: valid });
    expect(fetchImpl.mock.calls[0]![0]).toBe('/api/weather?cityId=laval-qc');
  });

  it('shows the server-provided safe message on an error status', async () => {
    const fetchImpl = async () => json({ error: 'weather_unavailable', message: 'Try again later.' }, 503);
    expect(await loadForecast('laval-qc', undefined, fetchImpl)).toEqual({ ok: false, message: 'Try again later.' });
  });

  it('falls back to the safe message for non-JSON, malformed or network failures', async () => {
    const cases: (typeof fetch)[] = [
      async () => new Response('<html>', { status: 502 }),
      async () => json({ cityId: 'laval-qc' }),
      async () => { throw new TypeError('offline'); },
    ];
    for (const fetchImpl of cases) {
      expect(await loadForecast('laval-qc', undefined, fetchImpl)).toEqual({ ok: false, message: FALLBACK_ERROR });
    }
  });
});
