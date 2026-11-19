import { describe, expect, it } from 'vitest';
import { isExpired, localDateString, nextDays, upcomingHours } from './forecast';
import type { DailySummary, HourlyPoint } from './weather/types';

const hour = (time: string): HourlyPoint => ({
  time, temperatureC: 1, precipitationProbability: 0, windKmh: 1, weatherCode: 0,
});
const day = (date: string): DailySummary => ({
  date, minC: 0, maxC: 1, precipitationProbability: 0, weatherCode: 0,
});

describe('localDateString', () => {
  it('builds a zero-padded YYYY-MM-DD date from parts', () => {
    const instant = Date.parse('2027-03-05T15:00:00Z');
    expect(localDateString(instant, 'America/Toronto')).toBe('2027-03-05');
    expect(localDateString(instant, 'America/Vancouver')).toBe('2027-03-05');
    expect(localDateString(instant, 'America/St_Johns')).toBe('2027-03-05');
  });

  it('switches date exactly at local midnight', () => {
    expect(localDateString(Date.parse('2027-01-16T04:59:00Z'), 'America/Toronto')).toBe('2027-01-15');
    expect(localDateString(Date.parse('2027-01-16T05:00:00Z'), 'America/Toronto')).toBe('2027-01-16');
  });

  it('handles the half-hour St. John\'s offset', () => {
    expect(localDateString(Date.parse('2027-01-16T03:29:00Z'), 'America/St_Johns')).toBe('2027-01-15');
    expect(localDateString(Date.parse('2027-01-16T03:30:00Z'), 'America/St_Johns')).toBe('2027-01-16');
  });
});

describe('upcomingHours', () => {
  const hourly = Array.from({ length: 30 }, (_, i) =>
    hour(new Date(Date.UTC(2027, 0, 16, i)).toISOString()));

  it('starts with the in-progress hour and returns at most 24 points', () => {
    const result = upcomingHours(hourly, Date.parse('2027-01-16T02:30:00Z'));
    expect(result[0]?.time).toBe('2027-01-16T02:00:00.000Z');
    expect(result).toHaveLength(24);
  });

  it('drops an hour once it has ended', () => {
    const result = upcomingHours(hourly, Date.parse('2027-01-16T03:00:00Z'));
    expect(result[0]?.time).toBe('2027-01-16T03:00:00.000Z');
  });

  it('returns nothing when every hour is in the past', () => {
    expect(upcomingHours(hourly, Date.parse('2027-02-01T00:00:00Z'))).toEqual([]);
  });
});

describe('nextDays', () => {
  const daily = ['2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19', '2026-01-20']
    .map(day);

  it("starts at today's date in the city zone, not the UTC date", () => {
    // 2026-01-16T07:30Z is 23:30 PST on Jan 15 in Vancouver (before BC's 2026 rule change,
    // so all tzdata versions agree).
    const result = nextDays(daily, 'America/Vancouver', Date.parse('2026-01-16T07:30:00Z'));
    expect(result.map(d => d.date)).toEqual(['2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19']);
  });

  it('returns five days', () => {
    expect(nextDays(daily, 'America/Toronto', Date.parse('2026-01-14T12:00:00Z'))).toHaveLength(5);
  });
});

describe('isExpired', () => {
  const fetchedAt = '2027-01-15T12:00:00.000Z';
  const t = Date.parse(fetchedAt);

  it('is fresh just before five minutes and expired at exactly five minutes', () => {
    expect(isExpired(fetchedAt, t + 5 * 60_000 - 1)).toBe(false);
    expect(isExpired(fetchedAt, t + 5 * 60_000)).toBe(true);
  });

  it('treats an unparseable timestamp as expired', () => {
    expect(isExpired('not-a-date', t)).toBe(true);
  });
});
