import { expect, test } from '@playwright/test';
import { makeForecast, routeBackdrop } from './fixtures';

// Synthetic forecast; CI never calls Open-Meteo.
const forecast = makeForecast({
  cityId: 'laval-qc',
  timezone: 'America/Toronto',
  fetchedAt: '2027-01-15T19:16:00Z',
  firstHour: '2027-01-15T19:00:00Z',
  firstDate: '2027-01-15',
  current: { time: '2027-01-15T19:15:00Z', temperatureC: -7.6, windKmh: 21.4, weatherCode: 3 },
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T19:20:00Z'));
});

test('shows current Laval conditions in °C and Laval local time', async ({ page }) => {
  await page.route('**/api/weather?*', route => route.fulfill({ json: forecast }));
  const request = page.waitForRequest(req => new URL(req.url()).pathname === '/api/weather');
  await page.goto('/');

  expect(new URL((await request).url()).searchParams.get('cityId')).toBe('laval-qc');
  const card = page.getByRole('region', { name: /Current conditions in Laval, Québec/ });
  await expect(card).toContainText('-8 °C');
  await expect(card).toContainText('Overcast');
  await expect(card).toContainText('21 km/h');
  await expect(card).toContainText('Fri, Jan 15, 14:15 EST');
  await expect(card).toContainText('Fri, Jan 15, 14:16 EST');
  await expect(page.getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute('href', 'https://open-meteo.com/');
});

test('shows missing readings as unavailable', async ({ page }) => {
  await page.route('**/api/weather?*', route => route.fulfill({
    json: { ...forecast, current: { time: forecast.current.time, temperatureC: null, windKmh: null, weatherCode: null } },
  }));
  await page.goto('/');
  await expect(page.getByLabel('Temperature')).toHaveText('Unavailable');
});

test('shows a retryable error when the weather API fails', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/weather?*', route => {
    calls += 1;
    return calls === 1
      ? route.fulfill({
        status: 503,
        json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' },
      })
      : route.fulfill({ json: forecast });
  });
  await routeBackdrop(page);
  await page.goto('/');

  // Next.js renders its own empty route announcer with role="alert"; filter to ours.
  const alert = page.getByRole('alert').filter({ hasText: 'Weather is temporarily unavailable. Try again.' });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('region', { name: /Current conditions/ })).toContainText('-8 °C');
  expect(calls).toBe(2);
});
