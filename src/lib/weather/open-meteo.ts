import { z } from 'zod';
import type { City } from '@/lib/cities';
import type { WeatherResponse } from './types';

/** Fixed provider endpoint. Never built from client input. */
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const PROVIDER_TIMEOUT_MS = 5_000;

export type ProviderOutcome = 'timeout' | 'network' | 'http_error' | 'invalid_response';

export class ProviderError extends Error {
  constructor(readonly outcome: ProviderOutcome) {
    super(`Open-Meteo request failed: ${outcome}`);
    this.name = 'ProviderError';
  }
}

const reading = z.number().finite().nullable().optional();

const openMeteoCurrentSchema = z.object({
  current: z.object({
    time: z.number().int().positive(),
    temperature_2m: reading,
    wind_speed_10m: reading,
    weather_code: z.number().int().nonnegative().nullable().optional(),
  }),
});

export function buildForecastUrl(city: City): URL {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: city.latitude.toFixed(4),
    longitude: city.longitude.toFixed(4),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timeformat: 'unixtime',
    timezone: 'GMT',
  }).toString();
  return url;
}

export type FetchCurrentOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

/**
 * Fetches current conditions for a catalogue city. Sends only public coordinates;
 * no client headers, IPs or identifiers are forwarded.
 */
export async function fetchCurrentWeather(
  city: City,
  { fetchImpl = fetch, now = Date.now, timeoutMs = PROVIDER_TIMEOUT_MS }: FetchCurrentOptions = {},
): Promise<WeatherResponse> {
  let response: Response;
  try {
    response = await fetchImpl(buildForecastUrl(city), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new ProviderError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network');
  }

  if (!response.ok) throw new ProviderError('http_error');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProviderError('invalid_response');
  }

  const parsed = openMeteoCurrentSchema.safeParse(body);
  if (!parsed.success) throw new ProviderError('invalid_response');

  const current = parsed.data.current;
  return {
    cityId: city.id,
    timezone: city.timeZone,
    fetchedAt: new Date(now()).toISOString(),
    current: {
      time: new Date(current.time * 1000).toISOString(),
      temperatureC: current.temperature_2m ?? null,
      windKmh: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code ?? null,
    },
  };
}
