import { expect, test, type Page, type Request } from '@playwright/test';
import { composer, makeForecast, reply, waitForPlanner } from './fixtures';

// WEA-23: any Canadian or US city of 5,000+ people, searched locally; display units.
// Synthetic forecasts only; the catalogue is the committed static file, served by the app.

const T = '2027-06-14T12:00:00Z';

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date(T));
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId') ?? 'laval-qc';
    return route.fulfill({ json: makeForecast({
      cityId, timezone: cityId.startsWith('gn-') ? 'America/Chicago' : 'America/Toronto',
      fetchedAt: '2027-06-14T11:59:00Z', firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
      temperatureC: 20, current: { temperatureC: 20, windKmh: 32 },
    }) });
  });
  const plans: unknown[] = [];
  await page.route('**/api/plan', route => {
    plans.push(route.request().postDataJSON());
    return route.fulfill({ json: { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' } });
  });
  await page.goto('/');
  await waitForPlanner(page);
  return { requests, plans };
}

const citySearch = (page: Page) => page.getByRole('combobox', { name: 'City', exact: true });
const weatherIds = (requests: Request[]) => requests
  .map(r => new URL(r.url()))
  .filter(u => u.pathname === '/api/weather')
  .map(u => u.searchParams.get('cityId'));

test('finds a US city in the local catalogue and loads its forecast by catalogue ID', async ({ page }) => {
  const { requests } = await setup(page);
  await citySearch(page).fill('Springfield, il');
  const option = page.getByRole('option', { name: 'Springfield, Illinois' });
  await expect(option).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(1);
  await option.click();
  await expect(page.getByRole('heading', { name: 'Current conditions in Springfield, Illinois' })).toBeVisible();
  expect(weatherIds(requests).at(-1)).toMatch(/^gn-\d+$/);

  // At most eight suggestions, largest cities first.
  await citySearch(page).fill('Spring');
  await expect(page.getByRole('option')).toHaveCount(8);

  // The catalogue is one static download; nothing typed ever leaves the browser.
  const urls = requests.map(r => decodeURIComponent(r.url()).toLowerCase());
  expect(urls.filter(u => u.includes('/data/cities-na.v1.json'))).toHaveLength(1);
  expect(urls.some(u => u.includes('spring'))).toBe(false);
});

test('plans in another country from the chat\'s city search', async ({ page }) => {
  const { plans } = await setup(page);
  await reply(page, 'Today');
  await reply(page, 'Hiking');
  await reply(page, 'Other city');
  await page.getByRole('combobox', { name: 'Other city' }).fill('Portland maine');
  await page.getByRole('option', { name: 'Portland, Maine' }).click();
  await expect(citySearch(page)).toHaveValue('Portland, Maine');
  await reply(page, '1 hour');
  await expect.poll(() => plans.length).toBe(1);
  expect(plans[0]).toMatchObject({ cityId: expect.stringMatching(/^gn-\d+$/), activity: 'hiking', durationHours: 1 });
});

test('switches every reading between metric and imperial and remembers the choice', async ({ page }) => {
  await setup(page);
  const current = page.locator('section[aria-labelledby="current-heading"]');
  await expect(current.getByLabel('Temperature')).toHaveText('20 °C');
  await expect(current).toContainText('32 km/h');

  const units = page.getByRole('group', { name: 'Units' });
  await units.getByRole('button', { name: '°F · mph' }).click();
  await expect(units.getByRole('button', { name: '°F · mph' })).toHaveAttribute('aria-pressed', 'true');
  await expect(current.getByLabel('Temperature')).toHaveText('68 °F');
  await expect(current).toContainText('20 mph');
  await expect(page.getByRole('table', { name: 'Hourly forecast' })).toContainText('68 °F');

  // Pico's day choices follow too; the request stays metric-free (no thresholds are sent).
  await reply(page, 'This weekend');
  await expect(composer(page).locator('.day-choice').first()).toContainText('°F');

  await page.reload();
  await waitForPlanner(page);
  await expect(current.getByLabel('Temperature')).toHaveText('68 °F');
  await units.getByRole('button', { name: '°C · km/h' }).click();
  await expect(current.getByLabel('Temperature')).toHaveText('20 °C');
});
