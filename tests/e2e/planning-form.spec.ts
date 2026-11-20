import { expect, test, type Page, type Request } from '@playwright/test';
import { makeForecast } from './fixtures';

// Synthetic responses only. The browser runs in America/Toronto with a fixed clock;
// /api/weather and /api/plan are intercepted, so CI never calls a provider.

const T = '2027-06-14T12:00:00Z'; // 08:00 EDT in Laval

const forecastFor = (cityId: string, timezone: string) => makeForecast({
  cityId, timezone, fetchedAt: '2027-06-14T11:59:00Z',
  firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14', temperatureC: 18,
});

type PlanReply = { status?: number; json: unknown };

/** Intercepts both API routes; replies to /api/plan in order and records each request. */
async function setup(page: Page, replies: PlanReply[]) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId');
    return route.fulfill({
      json: cityId === 'vancouver-bc'
        ? forecastFor('vancouver-bc', 'America/Vancouver')
        : forecastFor('laval-qc', 'America/Toronto'),
    });
  });
  const requests: Request[] = [];
  await page.route('**/api/plan', route => {
    requests.push(route.request());
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)]!;
    return route.fulfill({ status: reply.status ?? 200, json: reply.json });
  });
  await page.goto('/');
  return requests;
}

async function fillForm(page: Page, values: Partial<Record<'date' | 'duration', string>> = {}) {
  await page.getByLabel('Activity', { exact: true }).selectOption('hiking');
  await page.getByLabel('Date', { exact: true }).fill(values.date ?? '2027-06-14');
  await page.getByLabel('Duration (hours)', { exact: true }).fill(values.duration ?? '2');
}

const result = (page: Page) => page.getByRole('region', { name: 'Planning result' });
const findButton = (page: Page) => page.getByRole('button', { name: 'Find best time' });

// Effective criteria echoed by the server. The thresholds are synthetic test values, not
// the approved defaults, so the test proves the limits shown come from the response.
const criteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
  maxPrecipitationProbability: 35, maxWindKmh: 28,
};
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-14T15:00:00Z', end: '2027-06-14T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10, criteria,
};

test('shows the constraints used and forecast values for a successful Laval hiking request', async ({ page }) => {
  const requests = await setup(page, [{ json: match }]);
  await fillForm(page);
  await findButton(page).click();

  await expect(result(page)).toContainText('Best time: Mon, Jun 14, 11:00 EDT to 13:00 EDT');
  await expect(result(page)).toContainText('Rule-based recommendation');
  await expect(result(page)).toContainText('Highest precipitation probability10%');
  await expect(result(page)).toContainText('Highest sustained wind12 km/h');
  const constraints = result(page).getByRole('definition');
  await expect(constraints).toContainText(['10%', '12 km/h', 'hiking', 'Mon, Jun 14 (2027-06-14)', '2 hours', '35%', '28 km/h']);
  await expect(result(page)).toContainText('Based on the Open-Meteo forecast for Laval, Québec');
  // Explanation from the app's template, filled with the planner values.
  await expect(result(page)).toContainText('Every hour stays within the hiking limits of 35% precipitation chance and 28 km/h wind.');
  await expect(result(page)).toContainText('this one has the lowest precipitation chance (10%), then the lightest wind (12 km/h)');

  expect(requests).toHaveLength(1);
  expect(requests[0]!.headers()['content-type']).toBe('application/json');
  // Only the validated user-selected fields; the server resolves the thresholds.
  expect(requests[0]!.postDataJSON()).toEqual({
    cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
  });
});

test('reports clearly when no window meets the criteria', async ({ page }) => {
  await setup(page, [{ json: { outcome: 'no_match', mode: 'rule-based', criteria } }]);
  await fillForm(page);
  await findButton(page).click();
  await expect(result(page).getByRole('heading', { name: 'No time meets these limits' })).toBeVisible();
  await expect(result(page)).toContainText('No 2-hour period on Mon, Jun 14 in Laval, Québec');
  await expect(result(page)).toContainText('stays within the precipitation and wind limits for every hour');
  await expect(result(page)).not.toContainText('Best time');
});

test('reports insufficient forecast data and lets the user try again', async ({ page }) => {
  const requests = await setup(page, [
    { json: { outcome: 'insufficient', reason: 'missing_data', mode: 'rule-based', criteria } },
    { json: { outcome: 'insufficient', reason: 'stale', mode: 'rule-based', criteria } },
  ]);
  await fillForm(page);
  await findButton(page).click();
  await expect(result(page).getByRole('heading', { name: 'Forecast insufficient' })).toBeVisible();
  await expect(result(page)).toContainText('missing readings, so a reliable time cannot be recommended');
  await result(page).getByRole('button', { name: 'Try again' }).click();
  await expect(result(page)).toContainText('The forecast is out of date');
  expect(requests).toHaveLength(2);
});

test('validates inputs in the browser and sends nothing until they are valid', async ({ page }) => {
  const requests = await setup(page, [{ json: match }]);
  await findButton(page).click();

  const activity = page.getByLabel('Activity', { exact: true });
  await expect(activity).toBeFocused();
  await expect(activity).toHaveAttribute('aria-invalid', 'true');
  await expect(activity).toHaveAccessibleDescription('Choose an activity.');
  await expect(page.getByLabel('Date', { exact: true })).toHaveAccessibleDescription('Choose a date from 2027-06-14 to 2027-06-20.');

  await fillForm(page, { duration: '5', date: '2027-06-21' });
  await findButton(page).click();
  await expect(page.getByLabel('Date', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Duration (hours)', { exact: true })).toHaveAccessibleDescription('Enter a whole number of hours from 1 to 4.');
  await expect(activity).not.toHaveAttribute('aria-invalid');
  expect(requests).toHaveLength(0);

  await fillForm(page);
  await page.getByLabel('Duration (hours)', { exact: true }).press('Enter');
  await expect(result(page)).toContainText('Best time');
  expect(requests).toHaveLength(1);
});

test('has no precipitation or wind controls and shows no threshold values before a result', async ({ page }) => {
  await setup(page, [{ json: match }]);
  await expect(page.getByLabel('Maximum precipitation (%)')).toHaveCount(0);
  await expect(page.getByLabel('Maximum wind (km/h)')).toHaveCount(0);
  const planner = page.getByRole('region', { name: 'Plan an activity' });
  await expect(planner.getByRole('spinbutton')).toHaveCount(1); // Duration only
  await expect(planner).not.toContainText(/\d+\s*%|\d+\s*km\/h/);
});

test('shows an accessible message when planning is unavailable', async ({ page }) => {
  const requests = await setup(page, [{ json: { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' } }]);
  await fillForm(page);
  await findButton(page).click();
  await expect(result(page).getByRole('heading', { name: 'Activity planning is temporarily unavailable' })).toBeVisible();
  await expect(result(page)).toContainText('No time can be recommended right now.');
  await expect(result(page)).not.toContainText('Constraints used');
  // The forecast stays usable.
  await expect(page.getByRole('region', { name: 'Current conditions in Laval, Québec' })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('offers dates from today to six days ahead in the city zone', async ({ page }) => {
  await setup(page, [{ json: match }]);
  const date = page.getByLabel('Date', { exact: true });
  await expect(date).toHaveAttribute('min', '2027-06-14');
  await expect(date).toHaveAttribute('max', '2027-06-20');
});

test('shows server validation errors on the matching field', async ({ page }) => {
  await setup(page, [{
    status: 400,
    json: { error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'] },
  }]);
  await fillForm(page);
  await findButton(page).click();
  const date = page.getByLabel('Date', { exact: true });
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(date).toHaveAccessibleDescription('Choose a date from 2027-06-14 to 2027-06-20.');
  await expect(result(page)).toBeEmpty();
});

test('shows an accessible retryable error when planning is unavailable', async ({ page }) => {
  const requests = await setup(page, [
    { status: 503, json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' } },
    { json: match },
  ]);
  await fillForm(page);
  await findButton(page).click();
  const alert = result(page).getByRole('alert');
  await expect(alert).toContainText('Weather is temporarily unavailable. Try again.');
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(result(page)).toContainText('Best time');
  expect(requests).toHaveLength(2);
  expect(requests[1]!.postDataJSON()).toEqual(requests[0]!.postDataJSON());
});

test('shows a loading status while the plan is requested', async ({ page }) => {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => route.fulfill({ json: forecastFor('laval-qc', 'America/Toronto') }));
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/plan', async route => {
    await gate;
    await route.fulfill({ json: match });
  });
  await page.goto('/');
  await fillForm(page);
  await findButton(page).click();
  await expect(result(page).getByRole('status')).toHaveText('Finding the best time in Laval, Québec…');
  release();
  await expect(result(page)).toContainText('Best time');
});

test('never shows a result for a previously selected city', async ({ page }) => {
  await setup(page, [{ json: match }]);
  await fillForm(page);
  await findButton(page).click();
  await expect(result(page)).toContainText('Best time');

  await page.getByRole('combobox', { name: 'City' }).fill('Vanc');
  await page.getByRole('option', { name: /Vancouver/ }).click();
  await expect(result(page)).toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Plan an activity' })).toBeVisible();
  await expect(page.getByText('Find the best time in Vancouver, British Columbia')).toBeVisible();
});
