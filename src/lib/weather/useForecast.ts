'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadForecast } from './client';
import type { WeatherResponse } from './types';

export type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherResponse }
  | { status: 'error'; code?: string };

type Loaded = { cityId: string; state: ForecastState };

const EXPIRY_CHECK_MS = 30_000;

/**
 * Loads one city's forecast and re-checks its freshness every 30 s. A response for a
 * previously selected city is aborted and never returned for the current one.
 */
export function useForecast(cityId: string) {
  const [loaded, setLoaded] = useState<Loaded>({ cityId, state: { status: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    loadForecast(cityId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setNow(Date.now());
      setLoaded({
        cityId,
        state: result.ok ? { status: 'ready', data: result.data } : { status: 'error', code: result.code },
      });
    });
    return () => controller.abort();
  }, [cityId, attempt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), EXPIRY_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(() => {
    setLoaded({ cityId, state: { status: 'loading' } });
    setAttempt(n => n + 1);
  }, [cityId]);

  const state: ForecastState = loaded.cityId === cityId ? loaded.state : { status: 'loading' };
  return { state, now, reload };
}
