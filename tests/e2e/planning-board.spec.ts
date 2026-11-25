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

const board = (page: Page) => page.getByRole('region', { name: 'Planning board' });
const day = (page: Page, date: string) => board(page).locator(`.board-day[data-date="${date}"]`);
const plans = (page: Page) => board(page).locator('.board-plan');
const pico = (page: Page) => page.locator('.msg-current .guide-bubble');

async function planHikingSaturday(page: Page) {
  await reply(page, 'This weekend');
  await reply(page, 'Sat, Jun 19');
  await reply(page, 'Hiking');
  await reply(page, 'Laval');
  await reply(page, '2 hours');
}

test('fills in as the conversation goes: draft on its day, then the planner window', async ({ page }) => {
  await setup(page);
  await expect(board(page)).toContainText('Your week in Laval, Québec');
  await expect(board(page).getByRole('list', { name: 'Forecast days' }).locator('> li')).toHaveCount(7);
  await expect(plans(page)).toHaveCount(0);

  // The day comes first; the plan appears once there is an activity.
  await reply(page, 'This weekend');
  await reply(page, 'Sat, Jun 19');
  await expect(plans(page)).toHaveCount(0);
  await reply(page, 'Hiking');
  await expect(plans(page)).toHaveCount(1);
  await expect(board(page).locator('.board-tray')).toHaveCount(0);
  await expect(day(page, '2027-06-19').locator('.board-plan')).toHaveText(/Hiking\s*finding a time/);
  await expect(plans(page).first()).toHaveAttribute('aria-current', 'true');

  await reply(page, 'Laval');
  await reply(page, '2 hours');
  const planned = day(page, '2027-06-19').locator('.board-plan');
  await expect(planned).toHaveText(/Hiking\s*11:00 EDT – 13:00 EDT/);
  await expect(planned).toHaveAttribute('aria-label',
    'Hiking, Saturday, June 19, 2 hours, best time from 11:00 EDT to 13:00 EDT. Open in the chat');
  // The window is the planner's, hour for hour; the dashed lines are the server's limits.
  await expect(day(page, '2027-06-19').locator('.board-track .on')).toHaveCount(2);
  await expect(day(page, '2027-06-19').locator('.board-limit')).toHaveCount(2);
  await expect(day(page, '2027-06-19').locator('.board-track > span')).toHaveCount(24);
  await expect(day(page, '2027-06-14').locator('.board-track > span')).toHaveCount(16);

  // Trying another day takes the plan off its day until a new one is chosen.
  await reply(page, 'Try another day');
  await expect(board(page).locator('.board-tray')).toContainText('Not scheduled yet');
  await expect(plans(page).first()).toHaveAttribute('aria-label', 'Hiking, day not chosen, 2 hours, draft, no time yet. Open in the chat');
});

test('keeps several plans and reopens one in the chat without a request', async ({ page }) => {
  const plan = await setup(page, { replies: [match, noMatch] });
  await planHikingSaturday(page);
  await expect(day(page, '2027-06-19').locator('.board-plan')).toContainText('11:00 EDT');

  await reply(page, 'Plan another activity');
  // A new plan starts without the previous plan card.
  await expect(page.locator('.plan-card')).toHaveCount(0);
  await reply(page, 'Tomorrow');
  await reply(page, 'Walking');
  await reply(page, '1 hour');
  await expect(day(page, '2027-06-15').locator('.board-plan')).toHaveText(/Walking\s*No window/);
  await expect(plans(page)).toHaveCount(2);
  expect(plan.bodies).toHaveLength(2);

  await day(page, '2027-06-19').getByRole('button', { name: /^Hiking, Saturday, June 19/ }).click();
  await expect(pico(page)).toHaveText('Ready when you are. Shall I check Laval, Québec?');
  await expect(composer(page).getByRole('button', { name: 'Find best time' })).toBeFocused();
  // The window stays on the board until the visitor checks again.
  await expect(day(page, '2027-06-19').locator('.board-plan')).toHaveAttribute('aria-current', 'true');
  await expect(day(page, '2027-06-19').locator('.board-plan')).toContainText('11:00 EDT – 13:00 EDT');
  expect(plan.bodies).toHaveLength(2);

  // Changing an answer of the reopened plan updates that plan, not the other one.
  await page.getByRole('list', { name: 'Conversation with Pico' }).getByRole('button', { name: 'Edit your answer: 2 hours' }).click();
  await reply(page, '3 hours');
  await expect.poll(() => plan.bodies.length).toBe(3);
  await expect(plans(page)).toHaveCount(2);
});

test('shows each city its own plans', async ({ page }) => {
  await setup(page);
  await planHikingSaturday(page);
  await expect(plans(page)).toHaveCount(1);

  const city = page.getByRole('combobox', { name: 'City', exact: true });
  await city.fill('Gatin');
  await page.getByRole('option', { name: /Gatineau/ }).click();
  await expect(board(page)).toContainText('Your week in Gatineau, Québec');
  // The same answers start a draft in the new city; Laval's window stays in Laval.
  await expect(plans(page)).toHaveCount(1);
  await expect(day(page, '2027-06-19').locator('.board-plan')).toHaveText(/finding a time/);

  await city.fill('Laval');
  await page.getByRole('option', { name: /^Laval/ }).click();
  await expect(day(page, '2027-06-19').locator('.board-plan')).toContainText('11:00 EDT – 13:00 EDT');
});

test('keeps the days without bars when the forecast is unavailable', async ({ page }) => {
  await setup(page, { weatherDown: true });
  await expect(board(page)).toContainText('Forecast unavailable. Plans are still shown.');
  await expect(board(page).locator('.board-day')).toHaveCount(7);
  await expect(board(page).locator('.board-bars')).toHaveCount(0);
  await reply(page, 'Today');
  await reply(page, 'Walking');
  await expect(plans(page)).toHaveCount(1);
});

test('scrolls inside its own row on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await planHikingSaturday(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const row = board(page).getByRole('list', { name: 'Forecast days' });
  expect(await row.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  // The active plan's day was scrolled into the row's view.
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  const inRow = () => row.evaluate(el => {
    const column = el.querySelector<HTMLElement>('[data-date="2027-06-19"]')!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return column.left >= box.left - 1 && column.right <= box.right + 1;
  });
  await expect.poll(inRow).toBe(true);
});

test('stops every board animation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await planHikingSaturday(page);
  await expect(day(page, '2027-06-19').locator('.board-plan')).toHaveAttribute('aria-current', 'true');
  const running = () => page.evaluate(() => document.getAnimations()
    .filter(a => a.playState === 'running' && (a.effect as KeyframeEffect | null)?.target?.closest('.board')).length);
  await expect.poll(running).toBe(0);
});
