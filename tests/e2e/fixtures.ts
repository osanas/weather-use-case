// Synthetic /api/weather bodies for browser tests. CI never calls Open-Meteo.
import type { CurrentConditions as Current, WeatherResponse } from '../../src/lib/weather/types';

export type ForecastOptions = {
  cityId: string;
  timezone: string;
  fetchedAt: string;
  /** First hourly point, ISO UTC. */
  firstHour: string;
  /** First daily date in the city's zone, YYYY-MM-DD. */
  firstDate: string;
  current?: Partial<Current>;
  temperatureC?: number;
  hours?: number;
  days?: number;
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export function makeForecast(o: ForecastOptions): WeatherResponse {
  const temperatureC = o.temperatureC ?? 10;
  const start = Date.parse(o.firstHour);
  return {
    cityId: o.cityId,
    timezone: o.timezone,
    fetchedAt: o.fetchedAt,
    current: {
      time: o.fetchedAt,
      temperatureC,
      windKmh: 12,
      weatherCode: 3,
      ...o.current,
    },
    hourly: Array.from({ length: o.hours ?? 48 }, (_, i) => ({
      time: new Date(start + i * 3_600_000).toISOString(),
      temperatureC,
      precipitationProbability: 10,
      windKmh: 12,
      weatherCode: 3,
    })),
    daily: Array.from({ length: o.days ?? 7 }, (_, i) => ({
      date: addDays(o.firstDate, i),
      minC: temperatureC - 4,
      maxC: temperatureC + 4,
      precipitationProbability: 20,
      weatherCode: 3,
    })),
  };
}
