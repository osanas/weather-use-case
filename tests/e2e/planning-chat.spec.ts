import { expect, test, type Page } from '@playwright/test';
import { composer, makeForecast, reply, waitForPlanner } from './fixtures';

// Synthetic responses only, fixed clock in America/Toronto (Monday 2027-06-14, 08:00 EDT).
// The server runs with AI_ENABLED=false; Pico's lines come from the app, not a model.

const T = '2027-06-14T12:00:00Z';
const criteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2,
  maxPrecipitationProbability: 35, maxWindKmh: 28,
};
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10, criteria,
};

async function setup(page: Page, replies: { status?: number; json: unknown }[] = [{ json: match }]) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => route.fulfill({ json: makeForecast({
    cityId: 'laval-qc', timezone: 'America/Toronto', fetchedAt: '2027-06-14T11:59:00Z',
    firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
  }) }));
  const plan = { bodies: [] as unknown[] };
  await page.route('**/api/plan', route => {
    plan.bodies.push(route.request().postDataJSON());
    const r = replies[Math.min(plan.bodies.length - 1, replies.length - 1)]!;
    return route.fulfill({ status: r.status ?? 200, json: r.json });
  });
  await page.goto('/');
  await waitForPlanner(page);
  return plan;
}

const chat = (page: Page) => page.getByRole('region', { name: 'Plan an activity' });
const log = (page: Page) => page.getByRole('list', { name: 'Conversation with Pico' });
const pico = (page: Page) => page.locator('.msg-current .guide-bubble');
const result = (page: Page) => page.getByRole('region', { name: 'Planning result' });
const badges = (page: Page) => composer(page).locator('.quick-replies .quick-reply');

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

test('sits at the top, beside the current conditions on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  const c = await box(page, '.chat');
  const now = await box(page, 'section[aria-labelledby="current-heading"]');
  const hourly = await box(page, '.forecast');
  expect(c.x + c.width).toBeLessThanOrEqual(now.x);
  expect(c.y + c.height).toBeLessThanOrEqual(hourly.y + 1);
  await expect(page.locator('svg.pico-full')).toBeVisible();
});

test('comes first and fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  const c = await box(page, '.chat');
  const now = await box(page, 'section[aria-labelledby="current-heading"]');
  expect(c.y + c.height).toBeLessThanOrEqual(now.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('asks one question at a time and sends one request with the answers', async ({ page }) => {
  const plan = await setup(page);
  await expect(pico(page)).toHaveText('Hi, I’m Pico! What would you like to do?');
  await expect(pico(page)).toHaveAttribute('aria-live', 'polite');
  await expect(badges(page)).toHaveText(['Hiking', 'Cycling', 'Walking']);

  await reply(page, 'Hiking');
  await expect(pico(page)).toHaveText('Hiking it is! Where are you heading?');
  await expect(badges(page)).toHaveText(['Laval', 'Montréal', 'Québec City', 'Other city']);
  // Focus follows the conversation.
  await expect(badges(page).first()).toBeFocused();

  await reply(page, 'Laval');
  await expect(pico(page)).toHaveText('When do you want to go out?');
  await expect(badges(page)).toHaveText(['Today', 'Tomorrow', 'Day after tomorrow', 'This weekend', 'Next week', 'I’m flexible', 'Pick a date']);

  await reply(page, 'This weekend');
  await expect(pico(page)).toHaveText('Here’s the weekend forecast. Which day suits you?');
  await expect(badges(page).first()).toHaveText(/^Sat, Jun 19/);
  await reply(page, 'Sat, Jun 19');

  await expect(pico(page)).toHaveText('How long will you be out?');
  expect(plan.bodies).toHaveLength(0);
  await reply(page, '2 hours');

  await expect(result(page)).toContainText('Best time: Sat, Jun 19, 11:00 EDT to 13:00 EDT');
  await expect(pico(page)).toHaveText('Here’s your plan!');
  await expect(pico(page)).toHaveAttribute('aria-live', 'off');
  await expect(page.locator('.plan-card')).toContainText('11:00 EDT – 13:00 EDT');
  await expect(page.locator('.plan-strip .on')).toHaveCount(2);
  expect(plan.bodies).toEqual([{ cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2 }]);

  // The conversation is kept as a list of turns.
  await expect(log(page).locator('.msg-user .bubble')).toHaveText(['You: Hiking', 'You: Laval, Québec', 'You: This weekend', 'You: Sat, Jun 19', 'You: 2 hours']);
  await expect(chat(page).locator('.msg-pico .bubble').first()).not.toContainText(/\d+\s*%|km\/h|\d{1,2}:\d{2}/);
});

test('edits an answer and plans again', async ({ page }) => {
  const plan = await setup(page, [{ json: match }, { json: { ...match, criteria: { ...criteria, durationHours: 3 } } }]);
  await reply(page, 'Hiking');
  await reply(page, 'Laval');
  await reply(page, 'This weekend');
  await reply(page, 'Sat, Jun 19');
  await reply(page, '2 hours');
  await expect(result(page)).toContainText('Best time');

  await log(page).getByRole('button', { name: 'Edit your answer: 2 hours' }).click();
  await expect(pico(page)).toHaveText('How long will you be out?');
  await expect(badges(page).first()).toBeFocused();
  await reply(page, '3 hours');
  await expect.poll(() => plan.bodies.length).toBe(2);
  expect(plan.bodies[1]).toEqual({ cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 3 });
});

test('narrows a flexible choice to one day with its forecast, and explains next week', async ({ page }) => {
  await setup(page);
  await reply(page, 'Walking');
  await reply(page, 'Laval');
  await reply(page, 'I’m flexible');
  await expect(badges(page)).toHaveCount(8); // seven days and the date picker
  await expect(badges(page).first()).toContainText(/^Today.+°C.+% rain$/);

  await log(page).getByRole('button', { name: 'Edit your answer: I’m flexible' }).click();
  await reply(page, 'Next week');
  // Monday's horizon ends on Sunday, so Pico offers the last days he can see.
  await expect(pico(page)).toHaveText('I can see the forecast up to Sun, Jun 20. Which day suits you?');
  await expect(badges(page).filter({ hasText: /^(Fri|Sat|Sun)/ })).toHaveCount(3);
});

test('picks a date from the keyboard in the pixel calendar', async ({ page }) => {
  await setup(page);
  await reply(page, 'Cycling');
  await reply(page, 'Laval');
  const open = composer(page).getByRole('button', { name: 'Pick a date' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'June 2027' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Monday, June 14' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  // Past the horizon end: the focus stays on the last day.
  await expect(dialog.getByRole('button', { name: 'Sunday, June 20' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(dialog.getByRole('button', { name: 'Sunday, June 20' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('button', { name: 'Saturday, June 19' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();

  await open.click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(log(page).locator('.msg-user .bubble').last()).toHaveText('You: Wed, Jun 16');
  await expect(pico(page)).toHaveText('How long will you be out?');
});

test('takes a typed activity and a stepped duration', async ({ page }) => {
  const plan = await setup(page);
  await composer(page).getByRole('button', { name: 'Type it instead' }).click();
  const activity = page.getByLabel('Activity', { exact: true });
  await expect(activity).toBeFocused();
  await activity.selectOption('walking');
  await composer(page).getByRole('button', { name: 'OK' }).click();
  await expect(log(page).locator('.msg-user .bubble')).toHaveText(['You: Walking']);

  await reply(page, 'Laval');
  await reply(page, 'Tomorrow');
  await composer(page).getByRole('button', { name: 'Type it instead' }).click();
  await composer(page).getByRole('button', { name: 'One hour more' }).click();
  await composer(page).getByRole('button', { name: 'One hour more' }).click();
  await expect(page.getByLabel('Duration (hours)', { exact: true })).toHaveValue('3');
  await expect(composer(page).getByRole('button', { name: 'One hour more' })).toBeEnabled();
  await composer(page).getByRole('button', { name: 'OK' }).click();
  await expect.poll(() => plan.bodies.length).toBe(1);
  expect(plan.bodies[0]).toEqual({ cityId: 'laval-qc', activity: 'walking', date: '2027-06-15', durationHours: 3 });
});

test('chooses another city from the local search and plans there', async ({ page }) => {
  const plan = await setup(page, [{ json: { ...match, criteria: { ...criteria, cityId: 'quebec-qc' } } }]);
  await reply(page, 'Hiking');
  await reply(page, 'Other city');
  const search = page.getByRole('combobox', { name: 'Other city' });
  await search.fill('Gatin');
  await page.getByRole('option', { name: /Gatineau/ }).click();
  await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Gatineau, Québec');
  await expect(log(page).locator('.msg-user .bubble').last()).toHaveText('You: Gatineau, Québec');
  await reply(page, 'Today');
  await reply(page, '1 hour');
  await expect.poll(() => plan.bodies.length).toBe(1);
  expect(plan.bodies[0]).toMatchObject({ cityId: 'gatineau-qc', durationHours: 1 });
});

test('stops every chat animation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await reply(page, 'Hiking');
  const running = () => page.evaluate(() => document.getAnimations()
    .filter(a => a.playState === 'running' && (a.effect as KeyframeEffect | null)?.target?.closest('.chat')).length);
  await expect.poll(running).toBe(0);
  await expect(page.locator('svg.pico-full .pico-frame-1')).toBeHidden();
});
