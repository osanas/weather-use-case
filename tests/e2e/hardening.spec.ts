import { expect, test } from '@playwright/test';
import { makeForecast } from './fixtures';

// Production hardening checks against the built app. No provider is called: the page's
// weather request is intercepted and the API checks use requests rejected before any
// upstream work.

const EXPECTED_HEADERS: Record<string, string | RegExp> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': /frame-ancestors 'none'/,
  'permissions-policy': /geolocation=\(\)/,
};

function expectSecurityHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    if (typeof value === 'string') expect(headers[name]).toBe(value);
    else expect(headers[name]).toMatch(value);
  }
  expect(headers['x-powered-by']).toBeUndefined();
}

test('serves security headers on pages and API routes', async ({ page, request }) => {
  await page.route('**/api/weather?*', route => route.fulfill({ json: makeForecast({
    cityId: 'laval-qc', timezone: 'America/Toronto', fetchedAt: '2027-06-14T11:59:00Z',
    firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
  }) }));
  const response = await page.goto('/');
  expectSecurityHeaders(response!.headers());

  const weather = await request.get('/api/weather?cityId=unknown');
  expect(weather.status()).toBe(400);
  expectSecurityHeaders(weather.headers());
  expect(weather.headers()['cache-control']).toBe('no-store');

  const plan = await request.post('/api/plan', { data: 'x', headers: { 'Content-Type': 'text/plain' } });
  expect(plan.status()).toBe(415);
  expectSecurityHeaders(plan.headers());
});

test('links the privacy notice next to the Open-Meteo attribution', async ({ page }) => {
  await page.route('**/api/weather?*', route => route.fulfill({ status: 503, json: {
    error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.',
  } }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open-Meteo.com' })).toBeVisible();
  await page.getByRole('link', { name: 'Privacy notice' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
  for (const heading of ['Who runs this app', 'What the app does not collect', 'What is processed and who receives it', 'Application logs', 'Your rights']) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }
  await expect(page.getByText(/Open-Meteo/).first()).toBeVisible();
  await page.getByRole('link', { name: '← Back to Weather Window' }).click();
  await expect(page).toHaveURL(/\/$/);
});
