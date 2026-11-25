import { expect, test, type Page } from '@playwright/test';
import { BACKDROP_CITY_ID, makeForecast, routeBackdrop, withoutBackdrop } from './fixtures';

// The browser runs in America/Toronto (playwright.config.ts). Vancouver cases prove the
// city's zone is used for display, not the browser's.

const T = '2027-01-15T19:20:00Z';

const laval = (overrides: Partial<Parameters<typeof makeForecast>[0]> = {}) => makeForecast({
  cityId: 'laval-qc', timezone: 'America/Toronto', fetchedAt: '2027-01-15T19:19:00Z',
  firstHour: '2027-01-15T19:00:00Z', firstDate: '2027-01-15', temperatureC: -8, ...overrides,
});
const montreal = makeForecast({
  cityId: 'montreal-qc', timezone: 'America/Toronto', fetchedAt: '2027-01-15T19:19:00Z',
  firstHour: '2027-01-15T19:00:00Z', firstDate: '2027-01-15', temperatureC: 22,
});

type Body = ReturnType<typeof makeForecast>;

/**
 * Routes /api/weather by cityId and records every request's cityId. Without a Montréal
 * body, the backdrop's Montréal request is answered separately and not recorded.
 */
async function routeWeather(page: Page, bodies: Record<string, Body>) {
  const requested: string[] = [];
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId') ?? '';
    requested.push(cityId);
    const body = bodies[cityId];
    return body
      ? route.fulfill({ json: body })
      : route.fulfill({ status: 400, json: { error: 'invalid_city', message: 'Unknown city.' } });
  });
  if (!bodies[BACKDROP_CITY_ID]) await routeBackdrop(page);
  return requested;
}

const currentRegion = (page: Page, name: string) =>
  page.getByRole('region', { name: `Current conditions in ${name}` });
const firstBodyRow = (page: Page, table: string) =>
  page.getByRole('table', { name: table }).getByRole('row').nth(1);

const cityOptions = (page: Page) => page.locator('.city-selector').getByRole('option');

async function selectCity(page: Page, query: string, option: RegExp) {
  await page.getByRole('combobox', { name: 'City' }).fill(query);
  await page.getByRole('option', { name: option }).click();
}

test('selects a city with the keyboard only, without requests while typing', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  const requested = await routeWeather(page, { 'laval-qc': laval(), 'montreal-qc': montreal });
  await page.goto('/');
  await expect(currentRegion(page, 'Laval, Québec')).toContainText('-8 °C');
  // The backdrop loads Montréal once on its own; only the selection's requests count below.
  await expect.poll(() => requested).toContain(BACKDROP_CITY_ID);

  const combobox = page.getByRole('combobox', { name: 'City' });
  // The header's units and language switches (two buttons each) come first in the tab order.
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(combobox).toBeFocused();
  await page.keyboard.type('mont');
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  // The full catalogue answers; the largest "Mont…" city comes first.
  await expect(cityOptions(page).first()).toHaveText('Montréal, Québec');
  expect(withoutBackdrop(requested)).toEqual(['laval-qc']);

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Montréal, Québec' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');

  await expect(currentRegion(page, 'Montréal, Québec')).toContainText('22 °C');
  await expect(combobox).toHaveValue('Montréal, Québec');
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
  expect(withoutBackdrop(requested)).toEqual(['laval-qc', 'montreal-qc']);
});

test('shows no results and Escape restores the selected city', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  const requested = await routeWeather(page, { 'laval-qc': laval() });
  await page.goto('/');
  await expect(currentRegion(page, 'Laval, Québec')).toBeVisible();

  const combobox = page.getByRole('combobox', { name: 'City' });
  await combobox.fill('zzz');
  await expect(page.getByText('No matching cities')).toBeVisible();
  await expect(cityOptions(page)).toHaveCount(0);
  await combobox.press('Escape');
  await expect(combobox).toHaveValue('Laval, Québec');
  await expect(page.getByText('No matching cities')).toHaveCount(0);
  expect(requested).toEqual(['laval-qc']);
});

test('shows Vancouver times in PST in winter, with local dates', async ({ page }) => {
  // 2026-01-16T07:30Z is 23:30 PST on Thu Jan 15 in Vancouver and 02:30 EST on Fri Jan 16 in
  // Toronto. The winter date is before British Columbia's March 2026 switch to permanent
  // daylight time, so the assertion holds for every tzdata version.
  await page.clock.setFixedTime(new Date('2026-01-16T07:30:00Z'));
  await routeWeather(page, {
    'laval-qc': laval({ fetchedAt: '2026-01-16T07:29:00Z', firstHour: '2026-01-16T07:00:00Z', firstDate: '2026-01-16' }),
    'vancouver-bc': makeForecast({
      cityId: 'vancouver-bc', timezone: 'America/Vancouver', fetchedAt: '2026-01-16T07:29:00Z',
      firstHour: '2026-01-16T07:00:00Z', firstDate: '2026-01-15', temperatureC: 6,
    }),
  });
  await page.goto('/');
  await selectCity(page, 'Vancouver', /Vancouver/);

  await expect(currentRegion(page, 'Vancouver, British Columbia')).toContainText('6 °C');
  await expect(firstBodyRow(page, 'Hourly forecast')).toContainText('23:00 PST');
  await expect(page.getByRole('table', { name: 'Hourly forecast' })).not.toContainText('EST');
  await expect(firstBodyRow(page, '5-day forecast')).toContainText('Today, Thu, Jan 15');
  await expect(page.getByRole('table', { name: '5-day forecast' }).getByRole('row')).toHaveCount(6);
});

test('shows Vancouver times in PDT in summer, with local dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-07-15T19:00:00Z'));
  await routeWeather(page, {
    'laval-qc': laval({ fetchedAt: '2027-07-15T18:59:00Z', firstHour: '2027-07-15T19:00:00Z', firstDate: '2027-07-15' }),
    'vancouver-bc': makeForecast({
      cityId: 'vancouver-bc', timezone: 'America/Vancouver', fetchedAt: '2027-07-15T18:59:00Z',
      firstHour: '2027-07-15T19:00:00Z', firstDate: '2027-07-15', temperatureC: 21,
    }),
  });
  await page.goto('/');
  await selectCity(page, 'Vancouver', /Vancouver/);

  await expect(firstBodyRow(page, 'Hourly forecast')).toContainText('12:00 PDT');
  await expect(firstBodyRow(page, '5-day forecast')).toContainText('Today, Thu, Jul 15');
});

test('shows missing hourly and daily readings as unavailable', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  const body = laval();
  body.hourly[0] = { ...body.hourly[0]!, temperatureC: null, precipitationProbability: null, windKmh: null, weatherCode: null };
  body.daily[0] = { ...body.daily[0]!, minC: null, maxC: null, precipitationProbability: null, weatherCode: null };
  await routeWeather(page, { 'laval-qc': body });
  await page.goto('/');

  await expect(firstBodyRow(page, 'Hourly forecast').getByRole('cell')).toHaveText(Array(4).fill('Unavailable'));
  await expect(firstBodyRow(page, '5-day forecast').getByRole('cell')).toHaveText(Array(4).fill('Unavailable'));
});

test('recovers from a provider failure with Retry', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  let calls = 0;
  await page.route('**/api/weather?*', route => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 503, json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' } })
      : route.fulfill({ json: laval() });
  });
  await routeBackdrop(page);
  await page.goto('/');

  const alert = page.getByRole('alert').filter({ hasText: 'Weather is temporarily unavailable' });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('table', { name: 'Hourly forecast' })).toBeVisible();
  expect(calls).toBe(2);
});

test('never shows an expired forecast as current, and Refresh reloads it', async ({ page }) => {
  const start = Date.parse(T);
  await page.clock.install({ time: new Date(start) });
  let calls = 0;
  await page.route('**/api/weather?*', route => {
    calls += 1;
    const fetchedAt = new Date(calls === 1 ? start - 60_000 : start + 6 * 60_000).toISOString();
    return route.fulfill({ json: laval({ fetchedAt }) });
  });
  await routeBackdrop(page);
  await page.goto('/');
  await expect(currentRegion(page, 'Laval, Québec')).toBeVisible();

  await page.clock.fastForward('06:00');
  await expect(page.getByText('This forecast is out of date.')).toBeVisible();
  await expect(currentRegion(page, 'Laval, Québec')).toHaveCount(0);

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(currentRegion(page, 'Laval, Québec')).toBeVisible();
  await expect(page.getByText('This forecast is out of date.')).toHaveCount(0);
  expect(calls).toBe(2);
});

test('a slow response for the previous city never replaces the selected city', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  let releaseLaval: () => void = () => {};
  const lavalReleased = new Promise<void>(resolve => { releaseLaval = resolve; });
  await page.route('**/api/weather?*', async route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId');
    if (cityId === 'laval-qc') {
      await lavalReleased;
      // The browser aborted this request when the city changed; fulfilling may fail.
      await route.fulfill({ json: laval() }).catch(() => {});
      return;
    }
    await route.fulfill({ json: montreal });
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Loading forecast for Laval' })).toBeVisible();

  await selectCity(page, 'Montréal', /Montréal/);
  await expect(currentRegion(page, 'Montréal, Québec')).toContainText('22 °C');

  releaseLaval();
  await page.waitForTimeout(500);
  await expect(currentRegion(page, 'Montréal, Québec')).toContainText('22 °C');
  await expect(currentRegion(page, 'Laval, Québec')).toHaveCount(0);
});
