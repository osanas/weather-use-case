'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  describeWeatherCode,
  formatLocalTime,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { CurrentConditions, WeatherResponse } from '@/lib/weather/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherResponse }
  | { status: 'error'; message: string };

const FALLBACK_ERROR = 'Weather is temporarily unavailable. Try again.';

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Minimal shape check; the server has already validated the provider data. */
function toWeatherResponse(body: unknown, cityId: string): WeatherResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.cityId !== cityId || typeof b.timezone !== 'string' || typeof b.fetchedAt !== 'string') {
    return null;
  }
  if (typeof b.current !== 'object' || b.current === null) return null;
  const c = b.current as Record<string, unknown>;
  const current: CurrentConditions = {
    time: typeof c.time === 'string' ? c.time : null,
    temperatureC: nullableNumber(c.temperatureC),
    windKmh: nullableNumber(c.windKmh),
    weatherCode: nullableNumber(c.weatherCode),
  };
  return { cityId, timezone: b.timezone, fetchedAt: b.fetchedAt, current };
}

async function loadWeather(cityId: string, signal: AbortSignal): Promise<State> {
  try {
    const response = await fetch(`/api/weather?cityId=${encodeURIComponent(cityId)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : FALLBACK_ERROR;
      return { status: 'error', message };
    }
    const data = toWeatherResponse(body, cityId);
    return data ? { status: 'ready', data } : { status: 'error', message: FALLBACK_ERROR };
  } catch {
    return { status: 'error', message: FALLBACK_ERROR };
  }
}

export function CurrentWeather({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadWeather(cityId, controller.signal).then(next => {
      if (!controller.signal.aborted) setState(next);
    });
    return () => controller.abort();
  }, [cityId, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt(n => n + 1);
  }, []);

  return (
    <section aria-labelledby="current-heading" className="card">
      <h2 id="current-heading">Current conditions in {cityName}</h2>

      {state.status === 'loading' && <p role="status">Loading current weather…</p>}

      {state.status === 'error' && (
        <div role="alert" className="error">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="temperature" aria-label="Temperature">
            {formatTemperature(state.data.current.temperatureC)}
          </p>
          <dl>
            <dt>Conditions</dt>
            <dd>{describeWeatherCode(state.data.current.weatherCode)}</dd>
            <dt>Wind</dt>
            <dd>{formatWind(state.data.current.windKmh)}</dd>
            <dt>Observed</dt>
            <dd>{formatLocalTime(state.data.current.time, state.data.timezone)}</dd>
            <dt>Updated</dt>
            <dd>{formatLocalTime(state.data.fetchedAt, state.data.timezone)}</dd>
          </dl>
          <p className="note">Times are shown in {cityName} local time.</p>
        </>
      )}
    </section>
  );
}
