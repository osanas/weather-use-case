import {
  describeWeatherCode,
  formatDay,
  formatHour,
  formatPercent,
  formatTemperature,
  formatWind,
} from '@/lib/format';
import type { DailySummary, HourlyPoint } from '@/lib/weather/types';
import { useLocale, useMessages } from './Language';
import { useUnits } from './Units';

/*
 * Visually hidden data tables behind the weather widget (WX-02). Screen readers and the
 * browser tests read the upcoming hours and the five-day summary here, with the captions
 * "Hourly forecast" and "5-day forecast" and missing readings as "Unavailable".
 */

export function HourlyTable({ hours, timeZone }: { hours: HourlyPoint[]; timeZone: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  if (hours.length === 0) return <p className="sr-only">{t.widget.noUpcoming}</p>;
  return (
    <div className="sr-only">
      <table>
        <caption>{t.widget.hourlyTable}</caption>
        <thead>
          <tr>
            <th scope="col">{t.widget.time}</th>
            <th scope="col">{t.current.conditions}</th>
            <th scope="col">{t.widget.metric.temperature}</th>
            <th scope="col">{t.widget.metric.precipitation}</th>
            <th scope="col">{t.widget.metric.wind}</th>
          </tr>
        </thead>
        <tbody>
          {hours.map(hour => (
            <tr key={hour.time}>
              <th scope="row">{formatHour(hour.time, timeZone, locale)}</th>
              <td>{describeWeatherCode(hour.weatherCode, locale)}</td>
              <td>{formatTemperature(hour.temperatureC, units, locale)}</td>
              <td>{formatPercent(hour.precipitationProbability, locale)}</td>
              <td>{formatWind(hour.windKmh, units, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DailyTable({ days, today }: { days: DailySummary[]; today: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  if (days.length === 0) return <p className="sr-only">{t.widget.noDaily}</p>;
  return (
    <div className="sr-only">
      <table>
        <caption>{t.widget.dailyTable}</caption>
        <thead>
          <tr>
            <th scope="col">{t.widget.day}</th>
            <th scope="col">{t.current.conditions}</th>
            <th scope="col">{t.widget.low}</th>
            <th scope="col">{t.widget.high}</th>
            <th scope="col">{t.widget.metric.precipitation}</th>
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day.date}>
              <th scope="row">
                {t.widget.dayName(day.date === today, formatDay(day.date, locale))}
              </th>
              <td>{describeWeatherCode(day.weatherCode, locale)}</td>
              <td>{formatTemperature(day.minC, units, locale)}</td>
              <td>{formatTemperature(day.maxC, units, locale)}</td>
              <td>{formatPercent(day.precipitationProbability, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
