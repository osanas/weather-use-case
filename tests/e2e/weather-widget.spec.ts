import { expect, test, type Page } from '@playwright/test';
import { makeForecast, routeBackdrop } from './fixtures';

// Synthetic forecasts only. The browser runs in America/Toronto with a fixed clock.

const T = '2027-01-15T19:20:00Z'; // 14:20 EST, Fri Jan 15 in Laval

async function open(page: Page, { now = T, firstHour = '2027-01-15T19:00:00Z', firstDate = '2027-01-15', hours = 48 } = {}) {
  await page.clock.setFixedTime(new Date(now));
  const body = makeForecast({
    cityId: 'laval-qc', timezone: 'America/Toronto', fetchedAt: new Date(Date.parse(now) - 60_000).toISOString(),
    firstHour, firstDate, temperatureC: -8, hours,
  });
  await page.route('**/api/weather?*', route => route.fulfill({ json: body }));
  await routeBackdrop(page);
  await page.goto('/');
  await expect(widget(page)).toBeVisible();
}

const widget = (page: Page) => page.getByRole('region', { name: 'Forecast', exact: true });
const tab = (page: Page, name: string) => widget(page).getByRole('tab', { name });
const curveTable = (page: Page, name: string) => widget(page).getByRole('table', { name });
const day = (page: Page, name: RegExp) => widget(page).getByRole('button', { name });

test('switches the curve with tabs that follow the WAI-ARIA keyboard pattern', async ({ page }) => {
  await open(page);
  await expect(tab(page, 'Temperature')).toHaveAttribute('aria-selected', 'true');
  await expect(widget(page).getByRole('tabpanel', { name: 'Hourly chart' })).toBeVisible();
  await expect(tab(page, 'Temperature')).toHaveAttribute('aria-controls', await widget(page).getByRole('tabpanel').getAttribute('id') ?? '');
  // Today runs from the 14:00 hour to 23:00: ten hours plus the header row.
  await expect(curveTable(page, 'Temperature on Fri, Jan 15').getByRole('row')).toHaveCount(11);
  await expect(curveTable(page, 'Temperature on Fri, Jan 15').getByRole('row').nth(1)).toContainText('14:00 EST');
  await expect(curveTable(page, 'Temperature on Fri, Jan 15').getByRole('row').nth(1)).toContainText('-8 °C');

  await tab(page, 'Temperature').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Precipitation')).toBeFocused();
  await expect(tab(page, 'Precipitation')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Temperature')).toHaveAttribute('tabindex', '-1');
  await expect(curveTable(page, 'Precipitation on Fri, Jan 15').getByRole('row').nth(1)).toContainText('10%');

  await page.keyboard.press('End');
  await expect(tab(page, 'Wind')).toBeFocused();
  await expect(curveTable(page, 'Wind on Fri, Jan 15').getByRole('row').nth(1)).toContainText('12 km/h');

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Temperature')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Wind')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tab(page, 'Temperature')).toHaveAttribute('aria-selected', 'true');
});

test('selects a day with the day cards and keeps the hidden forecast tables', async ({ page }) => {
  await open(page);
  await expect(day(page, /^Today, Fri, Jan 15/)).toHaveAttribute('aria-pressed', 'true');
  await expect(widget(page).getByRole('button', { pressed: true })).toHaveCount(1);

  await day(page, /^Sat, Jan 16/).click();
  await expect(day(page, /^Sat, Jan 16/)).toHaveAttribute('aria-pressed', 'true');
  await expect(day(page, /^Today, Fri, Jan 15/)).toHaveAttribute('aria-pressed', 'false');
  await expect(widget(page).locator('.ww-weekday')).toHaveText('Saturday');
  await expect(curveTable(page, 'Temperature on Sat, Jan 16').getByRole('row')).toHaveCount(25);

  // The WX-02 tables stay on the upcoming hours and the next five days.
  await expect(page.getByRole('table', { name: 'Hourly forecast' }).getByRole('row').nth(1)).toContainText('14:00 EST');
  await expect(page.getByRole('table', { name: '5-day forecast' }).getByRole('row')).toHaveCount(6);
});

test('draws the 23 local hours of the spring-forward day', async ({ page }) => {
  // Midnight EST on Sat Mar 13 is 05:00Z; clocks skip from 02:00 to 03:00 on Sun Mar 14.
  await open(page, { now: '2027-03-13T17:00:00Z', firstHour: '2027-03-13T05:00:00Z', firstDate: '2027-03-13', hours: 72 });
  await day(page, /^Sun, Mar 14/).click();
  const rows = curveTable(page, 'Temperature on Sun, Mar 14').getByRole('row');
  await expect(rows).toHaveCount(24);
  await expect(rows.nth(2)).toContainText('01:00 EST');
  await expect(rows.nth(3)).toContainText('03:00 EDT');
  await expect(widget(page).locator('.ww-hours span')).toHaveText(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);
});

test('fits a phone screen and scrolls the day cards inside the widget', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const last = day(page, /^Thu, Jan 21/);
  await last.focus();
  await page.keyboard.press('Enter');
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  await expect(last).toBeInViewport();
});

test('adds no motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await day(page, /^Sat, Jan 16/).click();
  await tab(page, 'Wind').click();
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  expect(running).toBe(0);
});
