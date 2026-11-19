import { expect, test } from '@playwright/test';

const forecast = {
  cityId: 'laval-qc',
  timezone: 'America/Toronto',
  fetchedAt: '2027-06-14T12:00:00Z',
  current: { temperatureC: 18, windKmh: 15, weatherCode: 0 },
  hourly: [15, 30, 12, 11].map((windKmh, index) => ({
    time: new Date(Date.UTC(2027, 5, 14, 13 + index)).toISOString(),
    temperatureC: 18, precipitationProbability: 10, windKmh,
  })),
  daily: [{ date: '2027-06-14', minC: 12, maxC: 20, weatherCode: 0 }],
};

// TODO(WEA-8): re-enable in the WEA-8 PR once the planning form exists (Activity, Date, Duration,
// threshold inputs, "Find best time" button and the "Planning result" region). WEA-6 supplies
// the City combobox; /api/plan is intercepted, so only the form is missing.
for (const mode of ['agent', 'rule-based'] as const) {
  test.fixme(`shows the planned window in ${mode} mode`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-06-14T12:00:00Z'));
    await page.route('**/api/weather?*', route => route.fulfill({ json: forecast }));
    await page.route('**/api/plan', route => route.fulfill({ json: {
      outcome: 'match', mode, start: '2027-06-14T15:00:00Z',
      end: '2027-06-14T17:00:00Z', maxWindKmh: 12, maxPrecipitationProbability: 10,
    } }));
    await page.goto('/');
    await page.getByRole('combobox', { name: 'City' }).fill('Laval');
    await page.getByRole('option', { name: /Laval/ }).click();
    await page.getByLabel('Activity', { exact: true }).selectOption('hiking');
    await page.getByLabel('Date', { exact: true }).fill('2027-06-14');
    await page.getByLabel('Duration (hours)', { exact: true }).fill('2');
    await page.getByLabel('Maximum precipitation (%)', { exact: true }).fill('30');
    await page.getByLabel('Maximum wind (km/h)', { exact: true }).fill('25');
    const request = page.waitForRequest(req =>
      new URL(req.url()).pathname === '/api/plan' && req.method() === 'POST');
    await page.getByRole('button', { name: 'Find best time' }).click();
    expect((await request).postDataJSON()).toMatchObject({
      cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14',
      durationHours: 2, maxPrecipitationProbability: 30, maxWindKmh: 25,
    });
    const result = page.getByRole('region', { name: 'Planning result' });
    await expect(result).toContainText(/11:00/);
    await expect(result).toContainText(/13:00|1:00\s*PM/i);
    await expect(result).toContainText(mode === 'agent' ? /AI-assisted/i : /rule-based/i);
  });
}
