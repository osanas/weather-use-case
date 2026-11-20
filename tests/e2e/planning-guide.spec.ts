import { expect, test, type Page } from '@playwright/test';
import { makeForecast } from './fixtures';

// Synthetic responses only, fixed clock in America/Toronto. The server runs with
// AI_ENABLED=false, so every prompt below comes from the predefined guide, not a model.

const T = '2027-06-14T12:00:00Z';
const criteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
  maxPrecipitationProbability: 35, maxWindKmh: 28,
};
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-14T15:00:00Z', end: '2027-06-14T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10, criteria,
};

async function setup(page: Page, replies: { status?: number; json: unknown }[] = [{ json: match }]) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => route.fulfill({ json: makeForecast({
    cityId: 'laval-qc', timezone: 'America/Toronto', fetchedAt: '2027-06-14T11:59:00Z',
    firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
  }) }));
  let calls = 0;
  await page.route('**/api/plan', route => {
    const reply = replies[Math.min(calls++, replies.length - 1)]!;
    return route.fulfill({ status: reply.status ?? 200, json: reply.json });
  });
  await page.goto('/');
  await expect(guide(page)).toBeVisible();
}

const guide = (page: Page) => page.getByRole('complementary', { name: 'Planning guide' });
const bubble = (page: Page) => guide(page).locator('.guide-bubble');
const form = (page: Page) => page.locator('.planner form');
const activity = (page: Page) => page.getByLabel('Activity', { exact: true });
const date = (page: Page) => page.getByLabel('Date', { exact: true });
const duration = (page: Page) => page.getByLabel('Duration (hours)', { exact: true });
const findButton = (page: Page) => page.getByRole('button', { name: 'Find best time' });

async function box(page: Page, locator: ReturnType<Page['locator']>) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('sits beside the form on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  const g = await box(page, guide(page));
  const f = await box(page, form(page));
  expect(g.x + g.width).toBeLessThanOrEqual(f.x);
  expect(g.y).toBeLessThan(f.y + f.height);
  expect(f.y).toBeLessThan(g.y + g.height);
  await expectNoHorizontalScroll(page);
});

test('sits above the form in the page flow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  const g = await box(page, guide(page));
  const f = await box(page, form(page));
  expect(g.y + g.height).toBeLessThanOrEqual(f.y);
  expect(g.x + g.width).toBeLessThanOrEqual(375);
  await expectNoHorizontalScroll(page);
});

test('follows the fields as they are completed and reacts to the result', async ({ page }) => {
  await setup(page);
  await expect(bubble(page)).toHaveText('Hi, I’m Cirrus! What would you like to do in Laval, Québec? Pick hiking, cycling or walking.');
  await expect(bubble(page)).toHaveAttribute('aria-live', 'polite');

  await activity(page).selectOption('hiking');
  await expect(bubble(page)).toHaveText('Hiking it is! Which day? Pick a date up to Sun, Jun 20.');
  await date(page).fill('2027-06-14');
  await expect(bubble(page)).toHaveText('How long will you be out? Choose 1 to 4 hours.');
  await duration(page).fill('2');
  await expect(bubble(page)).toContainText('All set!');

  await findButton(page).click();
  await expect(page.getByRole('region', { name: 'Planning result' })).toContainText('Best time');
  await expect(bubble(page)).toHaveText('Good news! I found a time that fits. The details are below.');
  // The result region announces the outcome, so the guide does not repeat it.
  await expect(bubble(page)).toHaveAttribute('aria-live', 'off');
  await expect(guide(page)).not.toContainText(/\d+\s*%|km\/h|\d{1,2}:\d{2}/);

  await date(page).fill('2027-06-15');
  await expect(bubble(page)).toContainText('All set!');
});

test('points to the first missing field after submit without moving focus away from it', async ({ page }) => {
  await setup(page);
  await activity(page).selectOption('walking');
  await findButton(page).click();
  await expect(date(page)).toBeFocused();
  await expect(bubble(page)).toHaveText('One thing to fix first: the date. The message under the field says how.');
  await expect(bubble(page)).toHaveAttribute('aria-live', 'off');
});

test('reacts when no time fits and when planning is unavailable', async ({ page }) => {
  await setup(page, [
    { json: { outcome: 'no_match', mode: 'rule-based', criteria } },
    { json: { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' } },
  ]);
  await activity(page).selectOption('hiking');
  await date(page).fill('2027-06-14');
  await duration(page).fill('2');
  await findButton(page).click();
  await expect(bubble(page)).toContainText('No time that day stays within the limits.');
  await findButton(page).click();
  await expect(bubble(page)).toContainText('Planning is paused right now');
});

test('keeps the same message while a duration is typed', async ({ page }) => {
  await setup(page);
  await activity(page).selectOption('cycling');
  await date(page).fill('2027-06-14');
  await duration(page).focus();
  await page.keyboard.type('3');
  await expect(bubble(page)).toContainText('All set!');
  const text = await bubble(page).textContent();
  // Count every change to the message while more digits are typed and erased.
  await bubble(page).evaluate(el => {
    const w = window as unknown as { guideMutations: number };
    w.guideMutations = 0;
    new MutationObserver(records => { w.guideMutations += records.length; })
      .observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
  });
  // The field never becomes empty here, so the step stays "ready".
  await page.keyboard.type('2');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('1');
  await page.keyboard.press('Backspace');
  await expect(duration(page)).toHaveValue('3');
  expect(await page.evaluate(() => (window as unknown as { guideMutations: number }).guideMutations)).toBe(0);
  await expect(bubble(page)).toHaveText(text!);
});

test('never takes focus and leaves the form usable from the keyboard', async ({ page }) => {
  await setup(page);
  await expect(guide(page).locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  await expect(guide(page).locator('svg')).toHaveAttribute('aria-hidden', 'true');

  await activity(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(activity(page)).toHaveValue('hiking');
  await page.keyboard.press('Tab');
  await expect(date(page)).toBeFocused();
  await date(page).fill('2027-06-14');
  // Tab moves between the date's own segments, so check the order backwards from Duration.
  await duration(page).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(date(page)).toBeFocused();
  await duration(page).focus();
  await page.keyboard.type('2');
  await page.keyboard.press('Tab');
  await expect(findButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Planning result' })).toContainText('Best time');
  await expect(findButton(page)).toBeFocused();
});

test('stops the floating animation when reduced motion is requested', async ({ page }) => {
  await setup(page);
  const animation = () => guide(page).locator('svg').evaluate(el => getComputedStyle(el).animationName);
  expect(await animation()).toBe('guide-float');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animation()).toBe('none');
});
