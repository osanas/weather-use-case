'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatLocalTime } from '@/lib/format';
import { isExpired, localDateString, nextDays, upcomingHours } from '@/lib/forecast';
import { loadForecast } from '@/lib/weather/client';
import type { WeatherResponse } from '@/lib/weather/types';
import { CurrentWeather } from './CurrentWeather';
import { DailyForecast } from './DailyForecast';
import { HourlyForecast } from './HourlyForecast';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherResponse }
  | { status: 'error'; message: string };

const EXPIRY_CHECK_MS = 30_000;

/** Fetches and renders one city's forecast. Remounted (keyed) when the city changes. */
export function ForecastView({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    loadForecast(cityId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setNow(Date.now());
      setState(result.ok ? { status: 'ready', data: result.data } : { status: 'error', message: result.message });
    });
    return () => controller.abort();
  }, [cityId, attempt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), EXPIRY_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt(n => n + 1);
  }, []);

  if (state.status === 'loading') {
    return <p role="status" className="card">Loading forecast for {cityName}…</p>;
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="card error">
        <p>{state.message}</p>
        <button type="button" onClick={reload}>Retry</button>
      </div>
    );
  }

  const { data } = state;
  const expired = isExpired(data.fetchedAt, now);
  return (
    <div className="forecast">
      {expired ? (
        <div className="card stale">
          <p>
            This forecast is out of date. Last updated {formatLocalTime(data.fetchedAt, data.timezone)}.
          </p>
          <button type="button" onClick={reload}>Refresh</button>
        </div>
      ) : (
        <CurrentWeather data={data} cityName={cityName} />
      )}
      <HourlyForecast hours={upcomingHours(data.hourly, now)} timeZone={data.timezone} />
      <DailyForecast days={nextDays(data.daily, data.timezone, now)} today={localDateString(now, data.timezone)} />
    </div>
  );
}
