// Synthetic /api/weather bodies for browser tests. CI never calls Open-Meteo.
import { expect, type Page } from '@playwright/test';
import type { CurrentConditions as Current, WeatherResponse } from '../../src/lib/weather/types';

/**
 * Waits until Pico's chat is hydrated. The date bounds come from the browser clock, so the
 * chat is marked ready only once React runs; a click before that would be lost.
 */
export async function waitForPlanner(page: Page): Promise<void> {
  await expect(page.getByRole('region', { name: 'Plan an activity' })).toHaveAttribute('data-ready', 'true');
}

/** The answer area under Pico's question. */
export const composer = (page: Page) => page.getByRole('group', { name: 'Your answer' });

/** Selects one of Pico's answer badges by its label (day badges also carry a forecast summary). */
export async function reply(page: Page, label: string): Promise<void> {
  const escaped = label.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  await composer(page).getByRole('button', { name: new RegExp('^' + escaped) }).first().click();
}

export type ChatAnswers = { activity?: string; city?: string; when?: string; day?: string; duration?: string };

/** Answers Pico's questions with badges: by default hiking in Laval today for 2 hours. */
export async function planWithPico(page: Page, answers: ChatAnswers = {}): Promise<void> {
  await waitForPlanner(page);
  await reply(page, answers.activity ?? 'Hiking');
  await reply(page, answers.city ?? 'Laval');
  await reply(page, answers.when ?? 'Today');
  if (answers.day) await reply(page, answers.day);
  await reply(page, answers.duration ?? '2 hours');
}

/** The pixel-art backdrop always requests Montréal's forecast once when the page loads. */
export const BACKDROP_CITY_ID = 'montreal-qc';

/**
 * Answers the backdrop's Montréal request apart from the city under test, with an outage,
 * so the backdrop shows its neutral scene. Register it after the test's own /api/weather
 * route: Playwright tries the most recent matching route first. Use it only in tests where
 * Montréal is never the selected city.
 */
export async function routeBackdrop(page: Page): Promise<void> {
  await page.route(`**/api/weather?cityId=${BACKDROP_CITY_ID}`, route => route.fulfill({
    status: 503, json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' },
  }));
}

/** Requested city IDs without the backdrop's first Montréal request. */
export function withoutBackdrop(requested: readonly string[]): string[] {
  const i = requested.indexOf(BACKDROP_CITY_ID);
  return i === -1 ? [...requested] : [...requested.slice(0, i), ...requested.slice(i + 1)];
}

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
      isDay: true,
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
