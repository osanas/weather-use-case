import {
  describeWeatherCode,
  formatLocalTime,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { WeatherResponse } from '@/lib/weather/types';
import { useLocale, useMessages } from './Language';
import { useUnits } from './Units';

export function CurrentWeather({ data, cityName }: { data: WeatherResponse; cityName: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  return (
    <section aria-labelledby="current-heading" className="card">
      <h2 id="current-heading">{t.current.heading(cityName)}</h2>
      <p className="temperature" aria-label={t.current.temperature}>
        {formatTemperature(data.current.temperatureC, units, locale)}
      </p>
      <dl>
        <dt>{t.current.conditions}</dt>
        <dd>{describeWeatherCode(data.current.weatherCode, locale)}</dd>
        <dt>{t.current.wind}</dt>
        <dd>{formatWind(data.current.windKmh, units, locale)}</dd>
        <dt>{t.current.observed}</dt>
        <dd>{formatLocalTime(data.current.time, data.timezone, locale)}</dd>
        <dt>{t.current.updated}</dt>
        <dd>{formatLocalTime(data.fetchedAt, data.timezone, locale)}</dd>
      </dl>
      <p className="note">{t.current.localTime(cityName)}</p>
    </section>
  );
}
