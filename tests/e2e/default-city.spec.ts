import { expect, test, type Page } from '@playwright/test';
import { makeForecast } from './fixtures';

// Synthetic position headers only (no real visitor data). Weather is mocked, so no provider is called.

const T = '2027-06-14T12:00:00Z';

async function setup(page: Page, headers: Record<string, string>) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/*', route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId') ?? 'laval-qc';
    return route.fulfill({ json: makeForecast({
      cityId, timezone: 'America/Toronto',
      fetchedAt: '2027-06-14T11:59:00Z', firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
    }) });
  });
}

test('starts on the nearest city and says why', async ({ page }) => {
  await setup(page, { 'x-vercel-ip-latitude': '45.5017', 'x-vercel-ip-longitude': '-73.5673' });
  await page.goto('/');

  const notice = page.getByRole('status').filter({ hasText: 'approximate location' });
  await expect(notice).toContainText('Montréal');
  await expect(page.getByRole('heading', { name: /Montréal/ }).first()).toBeVisible();
});

test('falls back to Laval without position headers and shows no notice', async ({ page }) => {
  await setup(page, {});
  await page.goto('/');

  await expect(page.getByRole('status').filter({ hasText: 'approximate location' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Laval/ }).first()).toBeVisible();
});

test('the notice can be dismissed', async ({ page }) => {
  await setup(page, { 'x-vercel-ip-latitude': '45.5017', 'x-vercel-ip-longitude': '-73.5673' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'approximate location' })).toHaveCount(0);
});
