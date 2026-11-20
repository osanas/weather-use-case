import { z } from 'zod';
import type { City } from '@/lib/cities';
import type { WeatherResponse } from './types';

/** Fixed provider endpoint. Never built from client input. */
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const PROVIDER_TIMEOUT_MS = 5_000;
export const FORECAST_DAYS = 7;
const MAX_POINTS = 200;

export type ProviderOutcome = 'timeout' | 'network' | 'http_error' | 'invalid_response';

export class ProviderError extends Error {
  constructor(readonly outcome: ProviderOutcome) {
    super(`Open-Meteo request failed: ${outcome}`);
    this.name = 'ProviderError';
  }
}

const reading = z.number().finite().nullable();
const code = z.number().int().nonnegative().nullable();

const timeSeries = z
  .array(z.number().int().positive())
  .min(1)
  .max(MAX_POINTS)
  .refine(times => times.every((t, i) => i === 0 || t > times[i - 1]!), 'times must increase');

const hourlySchema = z
  .object({
    time: timeSeries,
    temperature_2m: z.array(reading),
    precipitation_probability: z.array(reading),
    wind_speed_10m: z.array(reading),
    weather_code: z.array(code),
  })
  .refine(h => [h.temperature_2m, h.precipitation_probability, h.wind_speed_10m, h.weather_code]
    .every(series => series.length === h.time.length), 'hourly arrays must align');

const dailySchema = z
  .object({
    time: timeSeries,
    weather_code: z.array(code),
    temperature_2m_max: z.array(reading),
    temperature_2m_min: z.array(reading),
    precipitation_probability_max: z.array(reading),
  })
  .refine(d => [d.weather_code, d.temperature_2m_max, d.temperature_2m_min, d.precipitation_probability_max]
    .every(series => series.length === d.time.length), 'daily arrays must align');

const openMeteoForecastSchema = z.object({
  /** Offset of the requested zone at request time, per the provider's time-zone rules. */
  utc_offset_seconds: z.number().int().min(-16 * 3600).max(16 * 3600),
  current: z.object({
    time: z.number().int().positive(),
    temperature_2m: reading.optional(),
    wind_speed_10m: reading.optional(),
    weather_code: code.optional(),
  }),
  hourly: hourlySchema,
  daily: dailySchema,
});

export function buildForecastUrl(city: City): URL {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: city.latitude.toFixed(4),
    longitude: city.longitude.toFixed(4),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: String(FORECAST_DAYS),
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timeformat: 'unixtime',
    // Daily aggregates are computed over the city's local day.
    timezone: city.timeZone,
  }).toString();
  return url;
}

export type FetchForecastOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

const toIso = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString();

const HALF_DAY_S = 12 * 3600;

/**
 * Converts a provider "local midnight" instant to its YYYY-MM-DD date without the
 * server's own time-zone data, which can lag the provider's (for example British
 * Columbia's 2026 change). The offset is the request-time offset and may differ by up
 * to an hour after a DST change within the horizon, so the date is read at local
 * noon, which a one-hour error cannot move to another day. The date is taken from
 * the fixed-format UTC ISO string, not a locale.
 */
export function localDateFromMidnight(epochSeconds: number, utcOffsetSeconds: number): string {
  return new Date((epochSeconds + utcOffsetSeconds + HALF_DAY_S) * 1000).toISOString().slice(0, 10);
}

/**
 * Fetches current, hourly and daily forecasts for a catalogue city. Sends only public
 * coordinates and the catalogue time zone; no client headers, IPs or identifiers.
 */
export async function fetchForecast(
  city: City,
  { fetchImpl = fetch, now = Date.now, timeoutMs = PROVIDER_TIMEOUT_MS }: FetchForecastOptions = {},
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

  const parsed = openMeteoForecastSchema.safeParse(body);
  if (!parsed.success) throw new ProviderError('invalid_response');

  const { current, hourly, daily, utc_offset_seconds: offset } = parsed.data;
  return {
    cityId: city.id,
    timezone: city.timeZone,
    fetchedAt: new Date(now()).toISOString(),
    current: {
      time: toIso(current.time),
      temperatureC: current.temperature_2m ?? null,
      windKmh: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code ?? null,
    },
    hourly: hourly.time.map((t, i) => ({
      time: toIso(t),
      temperatureC: hourly.temperature_2m[i] ?? null,
      precipitationProbability: hourly.precipitation_probability[i] ?? null,
      windKmh: hourly.wind_speed_10m[i] ?? null,
      weatherCode: hourly.weather_code[i] ?? null,
    })),
    daily: daily.time.map((t, i) => ({
      date: localDateFromMidnight(t, offset),
      minC: daily.temperature_2m_min[i] ?? null,
      maxC: daily.temperature_2m_max[i] ?? null,
      precipitationProbability: daily.precipitation_probability_max[i] ?? null,
      weatherCode: daily.weather_code[i] ?? null,
    })),
  };
}
