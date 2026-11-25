import { expect, test } from '@playwright/test';
import { planWithPico, waitForPlanner } from './fixtures';

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

for (const mode of ['agent', 'rule-based'] as const) {
  test(`shows the planned window in ${mode} mode`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-06-14T12:00:00Z'));
    await page.route('**/api/weather?*', route => route.fulfill({ json: forecast }));
    // The response echoes the effective criteria. Thresholds here are synthetic test values,
    // deliberately different from the approved defaults (src/lib/planner/thresholds.ts).
    await page.route('**/api/plan', route => route.fulfill({ json: {
      outcome: 'match', mode, start: '2027-06-14T15:00:00Z',
      end: '2027-06-14T17:00:00Z', maxWindKmh: 12, maxPrecipitationProbability: 10,
      criteria: {
        cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
        maxPrecipitationProbability: 35, maxWindKmh: 28,
      },
    } }));
    await page.goto('/');
    await waitForPlanner(page);
    await page.getByRole('combobox', { name: 'City' }).fill('Laval');
    await page.getByRole('option', { name: /Laval/ }).click();
    const request = page.waitForRequest(req =>
      new URL(req.url()).pathname === '/api/plan' && req.method() === 'POST');
    await planWithPico(page, { activity: 'Hiking', city: 'Laval', when: 'Today', duration: '2 hours' });
    // Thresholds are resolved by the server policy, never sent by the browser.
    expect((await request).postDataJSON()).toEqual({
      cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
    });
    const result = page.getByRole('region', { name: 'Planning result' });
    await expect(result).toContainText(/11:00/);
    await expect(result).toContainText(/13:00|1:00\s*PM/i);
    await expect(result).toContainText(mode === 'agent' ? /AI-assisted/i : /rule-based/i);
  });
}
