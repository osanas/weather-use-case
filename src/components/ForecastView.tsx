'use client';

import { formatLocalTime } from '@/lib/format';
import { errorText } from '@/lib/i18n/error-text';
import { isExpired } from '@/lib/forecast';
import type { ForecastState } from '@/lib/weather/useForecast';
import { CurrentWeather } from './CurrentWeather';
import { useLocale, useMessages } from './Language';

type Props = { state: ForecastState; now: number; cityName: string; onReload: () => void };

/** Current conditions, or the loading, error or out-of-date state of the forecast (WX-03). */
export function CurrentPanel({ state, now, cityName, onReload }: Props) {
  const locale = useLocale();
  const t = useMessages();
  if (state.status === 'loading') {
    return <p role="status" className="card">{t.current.loading(cityName)}</p>;
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="card error">
        <p>{errorText(t, state.code, 'weather')}</p>
        <button type="button" onClick={onReload}>{t.common.retry}</button>
      </div>
    );
  }
  const { data } = state;
  if (isExpired(data.fetchedAt, now)) {
    return (
      <div className="card stale">
        <p>{t.current.stale(formatLocalTime(data.fetchedAt, data.timezone, locale))}</p>
        <button type="button" onClick={onReload}>{t.common.refresh}</button>
      </div>
    );
  }
  return <CurrentWeather data={data} cityName={cityName} />;
}
