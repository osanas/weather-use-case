import type { WeatherResponse } from './types';

export const FORECAST_TTL_MS = 5 * 60 * 1000;

export type ForecastCache = {
  get(cityId: string): WeatherResponse | undefined;
  set(cityId: string, forecast: WeatherResponse): void;
};

/**
 * In-process cache for validated public forecasts, keyed by catalogue city ID.
 * Callers must only `set` forecasts that passed validation; errors are never stored.
 * Expired entries are treated as misses. Each server instance holds its own copy.
 */
export function createForecastCache({
  ttlMs = FORECAST_TTL_MS,
  now = Date.now,
}: { ttlMs?: number; now?: () => number } = {}): ForecastCache {
  const entries = new Map<string, { forecast: WeatherResponse; expiresAt: number }>();
  return {
    get(cityId) {
      const entry = entries.get(cityId);
      if (!entry) return undefined;
      if (now() >= entry.expiresAt) {
        entries.delete(cityId);
        return undefined;
      }
      return entry.forecast;
    },
    set(cityId, forecast) {
      entries.set(cityId, { forecast, expiresAt: now() + ttlMs });
    },
  };
}
