import {
  describeWeatherCode,
  formatHour,
  formatPercent,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { HourlyPoint } from '@/lib/weather/types';

export function HourlyForecast({ hours, timeZone }: { hours: HourlyPoint[]; timeZone: string }) {
  if (hours.length === 0) {
    return <p className="card">No upcoming hourly forecast is available.</p>;
  }
  return (
    <div className="card table-scroll">
      <table>
        <caption>Hourly forecast</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Conditions</th>
            <th scope="col">Temperature</th>
            <th scope="col">Precipitation</th>
            <th scope="col">Wind</th>
          </tr>
        </thead>
        <tbody>
          {hours.map(hour => (
            <tr key={hour.time}>
              <th scope="row">{formatHour(hour.time, timeZone)}</th>
              <td>{describeWeatherCode(hour.weatherCode)}</td>
              <td>{formatTemperature(hour.temperatureC)}</td>
              <td>{formatPercent(hour.precipitationProbability)}</td>
              <td>{formatWind(hour.windKmh)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
