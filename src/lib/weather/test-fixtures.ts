// Synthetic fixtures for unit tests only. Not imported by application code.
import type { WeatherResponse } from './types';

export function syntheticForecast(overrides: Partial<WeatherResponse> = {}): WeatherResponse {
  return {
    cityId: 'laval-qc',
    timezone: 'America/Toronto',
    fetchedAt: '2027-06-14T12:00:00.000Z',
    current: { time: '2027-06-14T12:00:00.000Z', temperatureC: 18, windKmh: 15, weatherCode: 0 },
    hourly: [
      { time: '2027-06-14T12:00:00.000Z', temperatureC: 18, precipitationProbability: 10, windKmh: 15, weatherCode: 0 },
      { time: '2027-06-14T13:00:00.000Z', temperatureC: 19, precipitationProbability: null, windKmh: 30, weatherCode: 1 },
    ],
    daily: [
      { date: '2027-06-14', minC: 12, maxC: 20, precipitationProbability: 10, weatherCode: 0 },
      { date: '2027-06-15', minC: null, maxC: 22, precipitationProbability: 40, weatherCode: 61 },
    ],
    ...overrides,
  };
}
