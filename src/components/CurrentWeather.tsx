import {
  describeWeatherCode,
  formatLocalTime,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { WeatherResponse } from '@/lib/weather/types';

export function CurrentWeather({ data, cityName }: { data: WeatherResponse; cityName: string }) {
  return (
    <section aria-labelledby="current-heading" className="card">
      <h2 id="current-heading">Current conditions in {cityName}</h2>
      <p className="temperature" aria-label="Temperature">
        {formatTemperature(data.current.temperatureC)}
      </p>
      <dl>
        <dt>Conditions</dt>
        <dd>{describeWeatherCode(data.current.weatherCode)}</dd>
        <dt>Wind</dt>
        <dd>{formatWind(data.current.windKmh)}</dd>
        <dt>Observed</dt>
        <dd>{formatLocalTime(data.current.time, data.timezone)}</dd>
        <dt>Updated</dt>
        <dd>{formatLocalTime(data.fetchedAt, data.timezone)}</dd>
      </dl>
      <p className="note">Times are shown in {cityName} local time.</p>
    </section>
  );
}
