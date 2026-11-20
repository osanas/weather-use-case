import { describeWeatherCode, formatDay, formatPercent, formatTemperature } from '@/lib/format';
import type { DailySummary } from '@/lib/weather/types';

export function DailyForecast({ days, today }: { days: DailySummary[]; today: string }) {
  if (days.length === 0) {
    return <p className="card">No daily forecast is available.</p>;
  }
  return (
    <div className="card table-scroll">
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
              <td>{formatTemperature(day.minC)}</td>
              <td>{formatTemperature(day.maxC)}</td>
              <td>{formatPercent(day.precipitationProbability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
