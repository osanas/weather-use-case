import { describe, expect, it, vi } from 'vitest';
import { getCityById } from '@/lib/cities';
import { buildForecastUrl, fetchCurrentWeather, ProviderError } from './open-meteo';

const laval = getCityById('laval-qc')!;
const FIXED_NOW = Date.parse('2027-06-14T12:03:00Z');
const now = () => FIXED_NOW;

// Synthetic Open-Meteo payload (timeformat=unixtime).
const validBody = {
  current: {
    time: Date.parse('2027-06-14T12:00:00Z') / 1000,
    interval: 900,
    temperature_2m: 18.2,
    wind_speed_10m: 14.8,
    weather_code: 1,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function expectOutcome(promise: Promise<unknown>, outcome: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).outcome).toBe(outcome);
}

describe('buildForecastUrl', () => {
  it('targets the fixed Open-Meteo host with catalogue coordinates and metric units', () => {
    const url = buildForecastUrl(laval);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: '45.5833',
      longitude: '-73.7500',
      current: 'temperature_2m,wind_speed_10m,weather_code',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      timeformat: 'unixtime',
      timezone: 'GMT',
    });
  });
});

describe('fetchCurrentWeather', () => {
  it('normalizes a valid response to UTC instants and catalogue time zone', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(validBody));
    const result = await fetchCurrentWeather(laval, { fetchImpl, now });
    expect(result).toEqual({
      cityId: 'laval-qc',
      timezone: 'America/Toronto',
      fetchedAt: '2027-06-14T12:03:00.000Z',
      current: { time: '2027-06-14T12:00:00.000Z', temperatureC: 18.2, windKmh: 14.8, weatherCode: 1 },
    });
  });

  it('sends no client-derived headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(validBody));
    await fetchCurrentWeather(laval, { fetchImpl, now });
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('maps missing readings to null', async () => {
    const body = { current: { time: validBody.current.time, temperature_2m: null } };
    const result = await fetchCurrentWeather(laval, { fetchImpl: async () => jsonResponse(body), now });
    expect(result.current).toEqual({
      time: '2027-06-14T12:00:00.000Z', temperatureC: null, windKmh: null, weatherCode: null,
    });
  });

  it('reports a non-2xx status as http_error', async () => {
    await expectOutcome(
      fetchCurrentWeather(laval, { fetchImpl: async () => jsonResponse({ reason: 'x' }, 502), now }),
      'http_error',
    );
  });

  it('reports a schema mismatch as invalid_response', async () => {
    await expectOutcome(
      fetchCurrentWeather(laval, { fetchImpl: async () => jsonResponse({ current: { time: 'soon' } }), now }),
      'invalid_response',
    );
  });

  it('reports a non-JSON body as invalid_response', async () => {
    await expectOutcome(
      fetchCurrentWeather(laval, { fetchImpl: async () => new Response('<html>'), now }),
      'invalid_response',
    );
  });

  it('reports a network failure', async () => {
    await expectOutcome(
      fetchCurrentWeather(laval, { fetchImpl: async () => { throw new TypeError('fetch failed'); }, now }),
      'network',
    );
  });

  it('reports a timeout', async () => {
    const fetchImpl = (_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    await expectOutcome(fetchCurrentWeather(laval, { fetchImpl, now, timeoutMs: 5 }), 'timeout');
  });
});
