import type {
  CurrentConditions,
  DailySummary,
  HourlyPoint,
  WeatherResponse,
} from './types';

export const FALLBACK_ERROR = 'Weather is temporarily unavailable. Try again.';

export type LoadResult =
  | { ok: true; data: WeatherResponse }
  /** `code` is the server's `error` field, used to localise the message. */
  | { ok: false; message: string; code?: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toHourly(v: unknown): HourlyPoint | null {
  if (!isObj(v) || typeof v.time !== 'string' || Number.isNaN(Date.parse(v.time))) return null;
  return {
    time: v.time,
    temperatureC: num(v.temperatureC),
    precipitationProbability: num(v.precipitationProbability),
    windKmh: num(v.windKmh),
    weatherCode: num(v.weatherCode),
  };
}

function toDaily(v: unknown): DailySummary | null {
  if (!isObj(v) || typeof v.date !== 'string' || !ISO_DATE.test(v.date)) return null;
  return {
    date: v.date,
    minC: num(v.minC),
    maxC: num(v.maxC),
    precipitationProbability: num(v.precipitationProbability),
    weatherCode: num(v.weatherCode),
  };
}

function mapAll<T>(items: unknown, map: (v: unknown) => T | null): T[] | null {
  if (!Array.isArray(items)) return null;
  const out: T[] = [];
  for (const item of items) {
    const mapped = map(item);
    if (!mapped) return null;
    out.push(mapped);
  }
  return out;
}

/**
 * Shape check for the API response. The server already validated provider data;
 * this guards the browser against a malformed or mismatched body.
 * Missing readings become `null`; a malformed entry rejects the whole response.
 */
export function toWeatherResponse(body: unknown, cityId: string): WeatherResponse | null {
  if (!isObj(body) || body.cityId !== cityId) return null;
  if (typeof body.timezone !== 'string' || typeof body.fetchedAt !== 'string') return null;
  if (!isObj(body.current)) return null;
  const c = body.current;
  const current: CurrentConditions = {
    time: typeof c.time === 'string' ? c.time : null,
    temperatureC: num(c.temperatureC),
    windKmh: num(c.windKmh),
    weatherCode: num(c.weatherCode),
    isDay: typeof c.isDay === 'boolean' ? c.isDay : null,
  };
  const hourly = mapAll(body.hourly, toHourly);
  const daily = mapAll(body.daily, toDaily);
  if (!hourly || !daily) return null;
  return { cityId, timezone: body.timezone, fetchedAt: body.fetchedAt, current, hourly, daily };
}

/** Loads a forecast from the same-origin API using a catalogue city ID. */
export async function loadForecast(
  cityId: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadResult> {
  try {
    const response = await fetchImpl(`/api/weather?cityId=${encodeURIComponent(cityId)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isObj(body) && typeof body.message === 'string' ? body.message : FALLBACK_ERROR;
      const code = isObj(body) && typeof body.error === 'string' ? body.error : undefined;
      return { ok: false, message, ...(code ? { code } : {}) };
    }
    const data = toWeatherResponse(body, cityId);
    return data ? { ok: true, data } : { ok: false, message: FALLBACK_ERROR };
  } catch {
    return { ok: false, message: FALLBACK_ERROR };
  }
}
