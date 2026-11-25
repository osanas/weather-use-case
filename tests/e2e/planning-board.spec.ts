import { expect, test, type Page } from '@playwright/test';
import { composer, makeForecast, reply, waitForPlanner } from './fixtures';

// Synthetic responses only, fixed clock in America/Toronto (Monday 2027-06-14, 08:00 EDT).

const T = '2027-06-14T12:00:00Z';
const criteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2,
  maxPrecipitationProbability: 35, maxWindKmh: 28,
};
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10, criteria,
};
const noMatch = { outcome: 'no_match', mode: 'rule-based', criteria: { ...criteria, activity: 'walking', date: '2027-06-15', durationHours: 1 } };

async function setup(page: Page, options: { replies?: unknown[]; weatherDown?: boolean } = {}) {
  const replies = options.replies ?? [match];
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => {
    if (options.weatherDown) {
      return route.fulfill({ status: 503, json: { error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.' } });
    }
    const cityId = new URL(route.request().url()).searchParams.get('cityId') ?? 'laval-qc';
    return route.fulfill({ json: makeForecast({
      cityId, timezone: 'America/Toronto', fetchedAt: '2027-06-14T11:59:00Z',
      firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14', hours: 168,
    }) });
  });
  const plan = { bodies: [] as unknown[] };
  await page.route('**/api/plan', route => {
    plan.bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: replies[Math.min(plan.bodies.length - 1, replies.length - 1)] });
  });
  await page.goto('/');
  await waitForPlanner(page);
  return plan;
}

const widget = (page: Page) => page.getByRole('region', { name: 'Forecast', exact: true });
const dayCard = (page: Page, name: RegExp) => widget(page).getByRole('button', { name });
const dayItem = (page: Page, name: RegExp) => widget(page).locator('.ww-day-item').filter({ has: page.getByRole('button', { name }) });
const plans = (page: Page) => page.locator('.board-plan');
const tray = (page: Page) => page.getByRole('region', { name: 'Your plans' });
const pico = (page: Page) => page.locator('.msg-current .guide-bubble');
const SAT = /^Sat, Jun 19:/;

async function planHikingSaturday(page: Page) {
  await reply(page, 'This weekend');
  await reply(page, 'Sat, Jun 19');
  await reply(page, 'Hiking');
  await reply(page, 'Laval');
  await reply(page, '2 hours');
}

test('puts the plan under its day card, then draws the planner window on the curve', async ({ page }) => {
  await setup(page);
  await expect(plans(page)).toHaveCount(0);
  await expect(tray(page)).toHaveCount(0);

  // The day comes first; the plan appears once there is an activity.
  await reply(page, 'This weekend');
  await reply(page, 'Sat, Jun 19');
  await expect(plans(page)).toHaveCount(0);
  await reply(page, 'Hiking');
  await expect(dayItem(page, SAT).locator('.board-plan')).toHaveText(/Hiking\s*finding a time/);
  // The widget follows the plan's day.
  await expect(dayCard(page, SAT)).toHaveAttribute('aria-pressed', 'true');

  await reply(page, 'Laval');
  await reply(page, '2 hours');
  const chip = dayItem(page, SAT).locator('.board-plan');
  await expect(chip).toHaveText(/Hiking\s*11:00–13:00/);
  await expect(chip).toHaveAttribute('aria-label',
    'Hiking, Saturday, June 19, 2 hours, best time from 11:00 EDT to 13:00 EDT. Open in the chat');
  await expect(chip).toHaveAttribute('aria-current', 'true');
  // One band on the curve for the planner's window; the limit appears on the precipitation tab.
  await expect(widget(page).locator('.ww-window')).toHaveCount(1);
  await expect(widget(page).locator('.ww-window-active')).toHaveCount(1);
  await expect(widget(page).locator('.ww-limit')).toHaveCount(0);
  await widget(page).getByRole('tab', { name: 'Precipitation' }).click();
  await expect(widget(page).locator('.ww-limit-label')).toHaveText('Limit 35%');
});

test('keeps several plans and reopens one in the chat without a request', async ({ page }) => {
  const plan = await setup(page, { replies: [match, noMatch] });
  await planHikingSaturday(page);
  await expect(dayItem(page, SAT).locator('.board-plan')).toContainText('11:00');

  await reply(page, 'Plan another activity');
  await expect(page.locator('.plan-card')).toHaveCount(0);
  await reply(page, 'Tomorrow');
  await reply(page, 'Walking');
  await reply(page, '1 hour');
  await expect(dayItem(page, /^Tue, Jun 15:/).locator('.board-plan')).toHaveText(/Walking\s*No window/);
  await expect(dayCard(page, /^Tue, Jun 15:/)).toHaveAttribute('aria-pressed', 'true');
  await expect(plans(page)).toHaveCount(2);
  expect(plan.bodies).toHaveLength(2);

  await dayItem(page, SAT).getByRole('button', { name: /^Hiking, Saturday, June 19/ }).click();
  await expect(pico(page)).toHaveText('Ready when you are. Shall I check Laval, Québec?');
  await expect(composer(page).getByRole('button', { name: 'Find best time' })).toBeFocused();
  await expect(dayCard(page, SAT)).toHaveAttribute('aria-pressed', 'true');
  // The window stays until the visitor checks again.
  await expect(dayItem(page, SAT).locator('.board-plan')).toHaveAttribute('aria-current', 'true');
  await expect(widget(page).locator('.ww-window-active')).toHaveCount(1);
  expect(plan.bodies).toHaveLength(2);
});

test('lets the visitor pick another day card while a plan is shown', async ({ page }) => {
  await setup(page);
  await planHikingSaturday(page);
  await dayCard(page, /^Wed, Jun 16:/).click();
  await expect(dayCard(page, /^Wed, Jun 16:/)).toHaveAttribute('aria-pressed', 'true');
  await expect(widget(page).locator('.ww-window')).toHaveCount(0);
  await expect(dayItem(page, SAT).locator('.board-plan')).toBeVisible();
});

test('shows each city its own plans', async ({ page }) => {
  await setup(page);
  await planHikingSaturday(page);
  await expect(plans(page)).toHaveCount(1);

  const city = page.getByRole('combobox', { name: 'City', exact: true });
  await city.fill('Gatin');
  await page.getByRole('option', { name: /Gatineau/ }).click();
  // The same answers start a draft in the new city; Laval's window stays in Laval.
  await expect(plans(page)).toHaveCount(1);
  await expect(dayItem(page, SAT).locator('.board-plan')).toHaveText(/finding a time/);

  await city.fill('Laval');
  await page.getByRole('option', { name: /^Laval/ }).click();
  await expect(dayItem(page, SAT).locator('.board-plan')).toContainText('11:00–13:00');
});

test('lists plans in the tray when the forecast is unavailable', async ({ page }) => {
  await setup(page, { weatherDown: true });
  await expect(widget(page)).toHaveCount(0);
  await reply(page, 'Today');
  await reply(page, 'Walking');
  await expect(tray(page).locator('.board-plan')).toHaveCount(1);
  await expect(tray(page).locator('.board-plan')).toHaveAttribute('aria-label', /^Walking, Monday, June 14/);
});

test('fits a phone screen with plans under the day cards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await planHikingSaturday(page);
  await expect(dayItem(page, SAT).locator('.board-plan')).toContainText('11:00–13:00');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('stops every plan animation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await planHikingSaturday(page);
  await expect(dayItem(page, SAT).locator('.board-plan')).toHaveAttribute('aria-current', 'true');
  const running = () => page.evaluate(() => document.getAnimations()
    .filter(a => a.playState === 'running' && (a.effect as KeyframeEffect | null)?.target?.closest('.board-plan, .ww')).length);
  await expect.poll(running).toBe(0);
});
