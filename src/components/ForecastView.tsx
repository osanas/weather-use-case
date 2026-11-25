'use client';

import { formatLocalTime } from '@/lib/format';
import { isExpired } from '@/lib/forecast';
import type { ForecastState } from '@/lib/weather/useForecast';
import { CurrentWeather } from './CurrentWeather';

type Props = { state: ForecastState; now: number; cityName: string; onReload: () => void };

/** Current conditions, or the loading, error or out-of-date state of the forecast (WX-03). */
export function CurrentPanel({ state, now, cityName, onReload }: Props) {
  if (state.status === 'loading') {
    return <p role="status" className="card">Loading forecast for {cityName}…</p>;
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="card error">
        <p>{state.message}</p>
        <button type="button" onClick={onReload}>Retry</button>
      </div>
    );
  }
  const { data } = state;
  if (isExpired(data.fetchedAt, now)) {
    return (
      <div className="card stale">
        <p>This forecast is out of date. Last updated {formatLocalTime(data.fetchedAt, data.timezone)}.</p>
        <button type="button" onClick={onReload}>Refresh</button>
      </div>
    );
  }
  return <CurrentWeather data={data} cityName={cityName} />;
}
