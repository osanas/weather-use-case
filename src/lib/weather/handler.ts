import { getCityById, type City } from '@/lib/cities';
import { createForecastCache, type ForecastCache } from './cache';
import { fetchForecast, ProviderError, type ProviderOutcome } from './open-meteo';
import type { ProviderForecast, WeatherErrorBody, WeatherResponse } from './types';

/** Only these fields may be logged. No URLs, headers, IPs or bodies. */
export type WeatherLogEntry = {
  route: 'weather';
  status: '4xx' | '5xx';
  provider: 'open-meteo';
  outcome: ProviderOutcome | 'invalid_city';
  elapsedMs: number;
};

export type WeatherHandlerDeps = {
  cache: ForecastCache;
  fetchForecast: (city: City) => Promise<ProviderForecast>;
  log: (entry: WeatherLogEntry) => void;
  now: () => number;
};

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The public response omits the server-only local-day boundaries. */
export function toPublicForecast({ localDays, ...body }: ProviderForecast): WeatherResponse {
  void localDays;
  return body;
}

function errorResponse(status: number, body: WeatherErrorBody): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function createWeatherHandler(deps: WeatherHandlerDeps) {
  return async function GET(request: Request): Promise<Response> {
    const startedAt = deps.now();
    const cityId = new URL(request.url).searchParams.get('cityId');
    const city = getCityById(cityId);
    if (!city) {
      deps.log({
        route: 'weather', status: '4xx', provider: 'open-meteo',
        outcome: 'invalid_city', elapsedMs: deps.now() - startedAt,
      });
      return errorResponse(400, { error: 'invalid_city', message: 'Unknown city.' });
    }

    const cached = deps.cache.get(city.id);
    if (cached) return Response.json(toPublicForecast(cached), { headers: NO_STORE });

    try {
      const forecast = await deps.fetchForecast(city);
      deps.cache.set(city.id, forecast);
      return Response.json(toPublicForecast(forecast), { headers: NO_STORE });
    } catch (error) {
      deps.log({
        route: 'weather', status: '5xx', provider: 'open-meteo',
        outcome: error instanceof ProviderError ? error.outcome : 'network',
        elapsedMs: deps.now() - startedAt,
      });
      return errorResponse(503, {
        error: 'weather_unavailable',
        message: 'Weather is temporarily unavailable. Try again.',
      });
    }
  };
}

export const defaultWeatherHandler = createWeatherHandler({
  cache: createForecastCache(),
  fetchForecast: city => fetchForecast(city),
  log: entry => console.warn(JSON.stringify(entry)),
  now: Date.now,
});
