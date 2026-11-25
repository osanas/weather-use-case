import {
  describeWeatherCode,
  formatDay,
  formatHour,
  formatPercent,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { DailySummary, HourlyPoint } from '@/lib/weather/types';
import { useUnits } from './Units';

/*
 * Visually hidden data tables behind the weather widget (WX-02). Screen readers and the
 * browser tests read the upcoming hours and the five-day summary here, with the captions
 * "Hourly forecast" and "5-day forecast" and missing readings as "Unavailable".
 */

export function HourlyTable({ hours, timeZone }: { hours: HourlyPoint[]; timeZone: string }) {
  const units = useUnits();
  if (hours.length === 0) return <p className="sr-only">No upcoming hourly forecast is available.</p>;
  return (
    <div className="sr-only">
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
              <td>{formatTemperature(hour.temperatureC, units)}</td>
              <td>{formatPercent(hour.precipitationProbability)}</td>
              <td>{formatWind(hour.windKmh, units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DailyTable({ days, today }: { days: DailySummary[]; today: string }) {
  const units = useUnits();
  if (days.length === 0) return <p className="sr-only">No daily forecast is available.</p>;
  return (
    <div className="sr-only">
      <table>
        <caption>5-day forecast</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Conditions</th>
            <th scope="col">Low</th>
            <th scope="col">High</th>
            <th scope="col">Precipitation</th>
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day.date}>
              <th scope="row">
                {day.date === today ? `Today, ${formatDay(day.date)}` : formatDay(day.date)}
              </th>
              <td>{describeWeatherCode(day.weatherCode)}</td>
              <td>{formatTemperature(day.minC, units)}</td>
              <td>{formatTemperature(day.maxC, units)}</td>
              <td>{formatPercent(day.precipitationProbability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
