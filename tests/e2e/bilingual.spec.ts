import { expect, test, type Page } from '@playwright/test';
import { makeForecast, waitForPlanner } from './fixtures';

// Synthetic responses only, fixed clock in America/Toronto (Monday 2027-06-14, 08:00 EDT).
// The English flows are covered by the other specs (UI-02).

const T = '2027-06-14T12:00:00Z';
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10,
  criteria: { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2, maxPrecipitationProbability: 30, maxWindKmh: 30 },
};

async function setup(page: Page, planStatus = 200) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId') ?? 'laval-qc';
    return route.fulfill({ json: makeForecast({
      cityId, timezone: 'America/Toronto', fetchedAt: '2027-06-14T11:59:00Z',
      firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14', hours: 168,
    }) });
  });
  const plan = { bodies: [] as unknown[] };
  await page.route('**/api/plan', route => {
    plan.bodies.push(route.request().postDataJSON());
    return planStatus === 200
      ? route.fulfill({ json: match })
      : route.fulfill({ status: planStatus, json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' } });
  });
  await page.goto('/');
  await waitForPlanner(page);
  return plan;
}

const french = (page: Page) => page.getByRole('button', { name: 'Français', exact: true }).click();
const reponse = async (page: Page, label: string) =>
  page.getByRole('group', { name: 'Votre réponse' }).getByRole('button', { name: new RegExp('^' + label) }).first().click();

async function planInFrench(page: Page) {
  await reponse(page, 'Cette fin de semaine');
  await reponse(page, 'sam\\. 19 juin');
  await reponse(page, 'Randonnée');
  await reponse(page, 'Laval');
  await reponse(page, '2 heures');
}

test('plans a hike entirely in French with the same request body', async ({ page }) => {
  const plan = await setup(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await french(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  await expect(page.getByRole('heading', { name: 'Planifier une activité' })).toBeVisible();
  await planInFrench(page);

  const result = page.getByRole('region', { name: 'Résultat de la planification' });
  await expect(result.getByRole('heading', { level: 3 })).toHaveText(/Meilleur moment : sam\. 19 juin, de 11\sh\s00 HAE à 13\sh\s00 HAE/);
  await expect(result).toContainText('Recommandation fondée sur des règles');
  await expect(page.getByRole('region', { name: 'Prévisions', exact: true })).toContainText('Couvert');
  await expect(page.locator('.board-plan')).toHaveAttribute('aria-label', /^Randonnée, samedi 19 juin, 2 heures, meilleur moment/);
  // The language is a display choice: nothing about it is sent or stored.
  expect(plan.bodies).toEqual([{ cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2 }]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }) + document.cookie)).toBe('{}');
});

test('translates an ongoing conversation when switching, and back', async ({ page }) => {
  await setup(page);
  await french(page);
  await reponse(page, 'Demain');
  await expect(page.locator('.msg-current .guide-bubble')).toHaveText('Qu’aimeriez-vous faire?');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.msg-current .guide-bubble')).toHaveText('What would you like to do?');
  await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Laval, Québec');
});

test('shows a server error in French, and in English after switching', async ({ page }) => {
  await setup(page, 503);
  await french(page);
  await planInFrench(page);
  const result = page.getByRole('region', { name: 'Résultat de la planification' });
  await expect(result.getByRole('alert')).toContainText('La météo est momentanément indisponible. Réessayez.');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Planning result' }).getByRole('alert'))
    .toContainText('Weather is temporarily unavailable. Try again.');
});

test('keeps French on the privacy notice for the visit and starts in English after a reload', async ({ page }) => {
  await setup(page);
  await french(page);
  await page.getByRole('link', { name: 'Avis de confidentialité' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Avis de confidentialité');
  await expect(page).toHaveTitle('Avis de confidentialité | Weather Window');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy notice');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
});

test('fits a phone screen in French', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await french(page);
  await planInFrench(page);
  await expect(page.locator('.board-plan')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
