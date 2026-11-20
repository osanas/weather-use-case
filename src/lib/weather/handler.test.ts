import { describe, expect, it, vi } from 'vitest';
import { getCityById, type City } from '@/lib/cities';
import { createForecastCache, FORECAST_TTL_MS } from './cache';
import { createWeatherHandler, toPublicForecast, type WeatherLogEntry } from './handler';
import { ProviderError } from './open-meteo';
import { syntheticProviderForecast } from './test-fixtures';
import type { ProviderForecast } from './types';

const forecast: ProviderForecast = syntheticProviderForecast();
const publicForecast = toPublicForecast(forecast);

function setup(fetchForecast: (city: City) => Promise<ProviderForecast>) {
  let t = 1_000;
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  const logs: WeatherLogEntry[] = [];
  const fetchSpy = vi.fn(fetchForecast);
  const handler = createWeatherHandler({
    cache: createForecastCache({ now: clock.now }),
    fetchForecast: fetchSpy,
    log: entry => logs.push(entry),
    now: clock.now,
  });
  const get = (query: string) =>
    handler(new Request(`http://localhost/api/weather${query}`, {
      headers: { 'X-Forwarded-For': '203.0.113.7', 'User-Agent': 'synthetic' },
    }));
  return { clock, logs, fetchSpy, get };
}

describe('GET /api/weather', () => {
  it('returns the validated forecast for a catalogue city with no-store', async () => {
    const { get, fetchSpy } = setup(async () => forecast);
    const res = await get('?cityId=laval-qc');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual(publicForecast);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0].id).toBe('laval-qc');
  });

  it('keeps the server-only local-day boundaries out of the public response', async () => {
    const { get } = setup(async () => forecast);
    const body = await (await get('?cityId=laval-qc')).json();
    expect(body).not.toHaveProperty('localDays');
    expect(Object.keys(body).sort()).toEqual(['cityId', 'current', 'daily', 'fetchedAt', 'hourly', 'timezone']);
    const cached = await (await get('?cityId=laval-qc')).json();
    expect(cached).not.toHaveProperty('localDays');
  });

  it.each(['', '?cityId=', '?cityId=unknown', '?cityId=LAVAL-QC'])(
    'rejects %j with 400 and makes no upstream call',
    async query => {
      const { get, fetchSpy, logs } = setup(async () => forecast);
      const res = await get(query);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_city', message: 'Unknown city.' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logs[0]?.outcome).toBe('invalid_city');
    },
  );

  it('returns a safe 503 on provider failure and logs only allowlisted fields', async () => {
    const { get, logs } = setup(async () => { throw new ProviderError('timeout'); });
    const res = await get('?cityId=laval-qc');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      error: 'weather_unavailable',
      message: 'Weather is temporarily unavailable. Try again.',
    });
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]!).sort()).toEqual(['elapsedMs', 'outcome', 'provider', 'route', 'status']);
    expect(logs[0]).toMatchObject({ route: 'weather', status: '5xx', provider: 'open-meteo', outcome: 'timeout' });
  });

  it('hides unexpected error details', async () => {
    const { get, logs } = setup(async () => { throw new Error('secret stack detail'); });
    const res = await get('?cityId=laval-qc');
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('secret');
    expect(JSON.stringify(logs)).not.toContain('secret');
  });

  it('serves repeat requests from cache within five minutes', async () => {
    const { get, fetchSpy, clock } = setup(async () => forecast);
    await get('?cityId=laval-qc');
    clock.advance(FORECAST_TTL_MS - 1);
    const res = await get('?cityId=laval-qc');
    expect(await res.json()).toEqual(publicForecast);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cached forecast expires', async () => {
    const { get, fetchSpy, clock } = setup(async () => forecast);
    await get('?cityId=laval-qc');
    clock.advance(FORECAST_TTL_MS);
    await get('?cityId=laval-qc');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not cache provider failures', async () => {
    const fetchForecast = vi
      .fn<(city: City) => Promise<ProviderForecast>>()
      .mockRejectedValueOnce(new ProviderError('http_error'))
      .mockResolvedValueOnce(forecast);
    const { get, fetchSpy } = setup(fetchForecast);
    expect((await get('?cityId=laval-qc')).status).toBe(503);
    expect((await get('?cityId=laval-qc')).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns current, hourly and daily data from a single upstream fetch', async () => {
    const { get, fetchSpy } = setup(async () => forecast);
    const first = await (await get('?cityId=laval-qc')).json();
    const second = await (await get('?cityId=laval-qc')).json();
    expect(first.hourly).toEqual(forecast.hourly);
    expect(first.daily).toEqual(forecast.daily);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches each catalogue city separately', async () => {
    const { get, fetchSpy } = setup(async city => syntheticProviderForecast({ cityId: city.id, timezone: city.timeZone }));
    const laval = await (await get('?cityId=laval-qc')).json();
    const vancouver = await (await get('?cityId=vancouver-bc')).json();
    await get('?cityId=vancouver-bc');
    expect(laval.cityId).toBe('laval-qc');
    expect(vancouver).toMatchObject({ cityId: 'vancouver-bc', timezone: 'America/Vancouver' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('passes only the catalogue city to the provider, never request data', async () => {
    const { get, fetchSpy } = setup(async () => forecast);
    await get('?cityId=laval-qc&lat=1&lon=2&timezone=Etc/UTC');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]).toEqual([getCityById('laval-qc')]);
  });

  it('does not cache invalid provider payloads', async () => {
    const fetchForecast = vi
      .fn<(city: City) => Promise<ProviderForecast>>()
      .mockRejectedValueOnce(new ProviderError('invalid_response'))
      .mockResolvedValueOnce(forecast);
    const { get, fetchSpy } = setup(fetchForecast);
    expect((await get('?cityId=laval-qc')).status).toBe(503);
    expect((await get('?cityId=laval-qc')).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
