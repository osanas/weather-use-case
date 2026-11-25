import { expect, test, type Page } from '@playwright/test';
import type { CurrentConditions } from '../../src/lib/weather/types';
import { makeForecast } from './fixtures';

// Synthetic responses only, fixed clock (12:00 UTC is 08:00 EDT in Montréal). The backdrop
// always requests montreal-qc; the selected city (Laval by default) gets its own forecast.

const T = '2027-06-14T12:00:00Z';

type MontrealReply = { status?: number; current?: Partial<CurrentConditions>; fetchedAt?: string };

async function setup(page: Page, montreal: MontrealReply) {
  await page.clock.setFixedTime(new Date(T));
  await page.route('**/api/weather?*', route => {
    const cityId = new URL(route.request().url()).searchParams.get('cityId');
    if (cityId === 'montreal-qc' && montreal.status) {
      return route.fulfill({ status: montreal.status, json: { error: 'weather_unavailable', message: 'Unavailable.' } });
    }
    return route.fulfill({ json: makeForecast({
      cityId: cityId ?? 'laval-qc', timezone: 'America/Toronto',
      fetchedAt: cityId === 'montreal-qc' ? montreal.fetchedAt ?? '2027-06-14T11:59:00Z' : '2027-06-14T11:59:00Z',
      firstHour: '2027-06-14T12:00:00Z', firstDate: '2027-06-14',
      current: cityId === 'montreal-qc' ? montreal.current : undefined,
    }) });
  });
  await page.goto('/');
}

const world = (page: Page) => page.locator('.world');
const label = (page: Page) => page.locator('.live-label');
const particles = (page: Page) => page.locator('canvas.particles');
const pico = (page: Page) => page.locator('.msg-current svg.pico-avatar');

test('shows live rain in Montréal with animated drops and puddles', async ({ page }) => {
  await setup(page, { current: { weatherCode: 61, temperatureC: 4, isDay: true } });
  await expect(world(page)).toHaveAttribute('data-scene', 'rain-day');
  await expect(label(page)).toHaveText('Live in Montréal: Slight rain, 4 °C · Updated 07:59 EDT');
  await expect(particles(page)).toHaveAttribute('data-kind', 'rain');
  await expect(particles(page)).toHaveAttribute('data-animating', 'true');
  await expect(page.locator('.layer-near .wet')).toHaveCSS('opacity', '1');
  await expect(page.locator('.layer-near .snowcaps')).toHaveCSS('opacity', '0');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'umbrella');
});

test('shows a snowy night with snow on the roofs', async ({ page }) => {
  await setup(page, { current: { weatherCode: 73, temperatureC: -6, isDay: false } });
  await expect(world(page)).toHaveAttribute('data-scene', 'snow-night');
  await expect(world(page)).toHaveAttribute('data-cold', 'true');
  await expect(particles(page)).toHaveAttribute('data-kind', 'snow');
  await expect(page.locator('.layer-near .snowcaps')).toHaveCSS('opacity', '1');
  await expect(label(page)).toContainText('Moderate snowfall, -6 °C');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'scarf lantern sleepy');
});

test('gives Pico sunglasses on a clear day', async ({ page }) => {
  await setup(page, { current: { weatherCode: 0, temperatureC: 22, isDay: true } });
  await expect(world(page)).toHaveAttribute('data-scene', 'clear-day');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'sunglasses');
});

test('gives Pico a shaking umbrella in a thunderstorm', async ({ page }) => {
  await setup(page, { current: { weatherCode: 95, temperatureC: 18, isDay: true } });
  await expect(world(page)).toHaveAttribute('data-scene', 'storm-day');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'umbrella shaking');
});

test('uses the local hour for night when the provider gives no day flag', async ({ page }) => {
  // 02:00 UTC is 22:00 EDT the previous evening.
  await setup(page, { current: { weatherCode: 0, isDay: null, time: '2027-06-14T02:00:00Z' } });
  await expect(world(page)).toHaveAttribute('data-scene', 'clear-night');
  await expect(page.locator('.stars')).toHaveCSS('opacity', '1');
});

test('never presents an expired Montréal forecast as live', async ({ page }) => {
  await setup(page, { current: { weatherCode: 61 }, fetchedAt: '2027-06-14T11:50:00Z' });
  await expect(label(page)).toHaveText('Live Montréal weather is unavailable right now.');
  await expect(world(page)).toHaveAttribute('data-scene', 'calm');
  await expect(particles(page)).toHaveAttribute('data-kind', 'none');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'none');
});

test('keeps the selected city usable when Montréal weather fails', async ({ page }) => {
  await setup(page, { status: 503 });
  await expect(label(page)).toHaveText('Live Montréal weather is unavailable right now.');
  await expect(world(page)).toHaveAttribute('data-scene', 'calm');
  await expect(pico(page)).toHaveAttribute('data-outfit', 'none');
  await expect(page.getByRole('heading', { name: 'Current conditions in Laval, Québec' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Hourly forecast' })).toBeVisible();
});

test('hides the decorative backdrop from assistive technology', async ({ page }) => {
  await setup(page, { current: { weatherCode: 2 } });
  await expect(page.locator('.backdrop')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.backdrop').locator('a, button, input, [tabindex]')).toHaveCount(0);
});

test('stops every animation when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, { current: { weatherCode: 95, isDay: true } });
  await expect(world(page)).toHaveAttribute('data-scene', 'storm-day');
  await expect(particles(page)).toHaveAttribute('data-kind', 'storm');
  await expect(particles(page)).toHaveAttribute('data-animating', 'false');
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  expect(running).toBe(0);
});

test('fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page, { current: { weatherCode: 3 } });
  await expect(world(page)).toHaveAttribute('data-scene', 'cloudy-day');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
