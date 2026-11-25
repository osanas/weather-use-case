import { describe, expect, it } from 'vitest';
import type { HourlyPoint } from '@/lib/weather/types';
import {
  applyChatPlan, boardId, hoursOfDay, inWindow, localHour, planFromChat, removePlan, stopChecking, upsertPlan, type BoardPlan,
} from './board';
import { NO_ANSWERS, type Answers, type ChatRequest } from './conversation';
import type { PlanRequest } from './criteria';
import type { PlanCriteria, PlanResponse } from './types';

// Synthetic state only.
const request: PlanRequest = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2 };
const criteria: PlanCriteria = { ...request, maxPrecipitationProbability: 35, maxWindKmh: 28 };
const full: Answers = { activity: 'hiking', label: '', city: true, when: 'weekend', date: '2027-06-19', duration: '2' };
const done = (data: PlanResponse): ChatRequest => ({ status: 'done', request, data });

/** Hourly points every hour from `from` (ISO UTC) for `count` hours. */
const hours = (from: string, count: number): HourlyPoint[] => Array.from({ length: count }, (_, i) => ({
  time: new Date(Date.parse(from) + i * 3_600_000).toISOString(),
  temperatureC: 10, precipitationProbability: 10, windKmh: 12, weatherCode: 3,
}));

describe('hoursOfDay', () => {
  it('keeps the 23 hours of the spring-forward day in Toronto', () => {
    // 2027-03-14: local midnight is 05:00Z (EST); the next midnight is 04:00Z (EDT).
    const day = hoursOfDay(hours('2027-03-13T23:00:00Z', 40), '2027-03-14', 'America/Toronto');
    expect(day).toHaveLength(23);
    expect(day[0]!.time).toBe('2027-03-14T05:00:00.000Z');
    expect(day.at(-1)!.time).toBe('2027-03-15T03:00:00.000Z');
  });

  it('keeps the 25 hours of the fall-back day in Toronto', () => {
    // 2027-11-07: local midnight is 04:00Z (EDT); the next midnight is 05:00Z (EST).
    const day = hoursOfDay(hours('2027-11-06T22:00:00Z', 40), '2027-11-07', 'America/Toronto');
    expect(day).toHaveLength(25);
    expect(day[0]!.time).toBe('2027-11-07T04:00:00.000Z');
    expect(day.at(-1)!.time).toBe('2027-11-08T04:00:00.000Z');
  });

  it('keeps 24 hours in a zone without daylight saving and only the hours the forecast has', () => {
    expect(hoursOfDay(hours('2027-06-14T00:00:00Z', 72), '2027-06-15', 'America/Regina')).toHaveLength(24);
    // The forecast starts at 08:00 local time, so today has 16 hours left.
    expect(hoursOfDay(hours('2027-06-14T12:00:00Z', 48), '2027-06-14', 'America/Toronto')).toHaveLength(16);
    expect(hoursOfDay([], '2027-06-14', 'America/Toronto')).toEqual([]);
  });
});

describe('inWindow', () => {
  it('includes the start hour and excludes the end', () => {
    const start = '2027-06-19T15:00:00Z';
    const end = '2027-06-19T17:00:00Z';
    expect(inWindow('2027-06-19T14:00:00Z', start, end)).toBe(false);
    expect(inWindow('2027-06-19T15:00:00.000Z', start, end)).toBe(true);
    expect(inWindow('2027-06-19T16:00:00Z', start, end)).toBe(true);
    expect(inWindow('2027-06-19T17:00:00Z', start, end)).toBe(false);
  });
});

describe('planFromChat', () => {
  it('has no plan before an activity is chosen', () => {
    expect(planFromChat('p1', 'laval-qc', NO_ANSWERS, null)).toBeNull();
    expect(planFromChat('p1', 'laval-qc', { ...NO_ANSWERS, activity: 'swimming' }, null)).toBeNull();
  });

  it('starts as a draft without a day, then gains the day and the duration', () => {
    expect(planFromChat('p1', 'laval-qc', { ...NO_ANSWERS, activity: 'hiking' }, null)).toEqual({
      id: 'p1', cityId: 'laval-qc', activity: 'hiking', date: null, durationHours: null, status: 'draft',
      answers: { ...NO_ANSWERS, activity: 'hiking' },
    });
    const dated = planFromChat('p1', 'laval-qc', { ...full, duration: '' }, null);
    expect(dated).toMatchObject({ date: '2027-06-19', durationHours: null, status: 'draft' });
    expect(planFromChat('p1', 'laval-qc', { ...full, duration: '7.5' }, null)?.durationHours).toBeNull();
  });

  it('follows the request sent with these answers', () => {
    expect(planFromChat('p1', 'laval-qc', full, { status: 'loading', request })?.status).toBe('checking');
    expect(planFromChat('p1', 'laval-qc', full, { status: 'error', request, message: 'Try again.' })?.status).toBe('error');
    expect(planFromChat('p1', 'laval-qc', full, done({ outcome: 'insufficient', reason: 'stale', mode: 'rule-based', criteria }))?.status)
      .toBe('insufficient');
    expect(planFromChat('p1', 'laval-qc', full, done({ outcome: 'planning_unavailable', reason: 'thresholds_not_defined' }))?.status)
      .toBe('unavailable');
  });

  it('copies the planner window and the server limits for a match', () => {
    const plan = planFromChat('p1', 'laval-qc', full, done({
      outcome: 'match', mode: 'rule-based', start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
      maxPrecipitationProbability: 10, maxWindKmh: 12, criteria,
    }));
    expect(plan).toMatchObject({
      status: 'match', date: '2027-06-19', durationHours: 2,
      start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
      limits: { maxPrecipitationProbability: 35, maxWindKmh: 28 },
    });
  });

  it('keeps the limits for no match, and turns back into a draft when the answers change', () => {
    const noMatch = done({ outcome: 'no_match', mode: 'rule-based', criteria });
    expect(planFromChat('p1', 'laval-qc', full, noMatch)).toMatchObject({
      status: 'no_match', limits: { maxPrecipitationProbability: 35, maxWindKmh: 28 },
    });
    const otherDay = planFromChat('p1', 'laval-qc', { ...full, date: '2027-06-20' }, noMatch);
    expect(otherDay).toMatchObject({ status: 'draft', date: '2027-06-20' });
    expect(otherDay).not.toHaveProperty('limits');
  });
});

describe('applyChatPlan', () => {
  const match = done({
    outcome: 'match', mode: 'rule-based', start: '2027-06-19T15:00:00Z', end: '2027-06-19T17:00:00Z',
    maxPrecipitationProbability: 10, maxWindKmh: 12, criteria,
  });
  const chat = (cityId: string, answers: Answers, req: ChatRequest | null = null) =>
    planFromChat(boardId('c1', cityId), cityId, answers, req);

  it('stores the plan under its conversation and city and removes it without an activity', () => {
    const one = applyChatPlan([], 'c1', 'laval-qc', chat('laval-qc', { ...NO_ANSWERS, activity: 'hiking' }));
    expect(one.map(p => p.id)).toEqual(['c1@laval-qc']);
    expect(applyChatPlan(one, 'c1', 'laval-qc', null)).toEqual([]);
  });

  it('moves a draft to the new city but keeps a checked plan where it was', () => {
    const draft = applyChatPlan([], 'c1', 'montreal-qc', chat('montreal-qc', { ...NO_ANSWERS, activity: 'hiking' }));
    const moved = applyChatPlan(draft, 'c1', 'laval-qc', chat('laval-qc', { ...NO_ANSWERS, activity: 'hiking', city: true }));
    expect(moved.map(p => p.id)).toEqual(['c1@laval-qc']);

    const checked = applyChatPlan(moved, 'c1', 'laval-qc', chat('laval-qc', full, match));
    const elsewhere = applyChatPlan(checked, 'c1', 'quebec-qc', chat('quebec-qc', full));
    expect(elsewhere.map(p => [p.id, p.status])).toEqual([['c1@laval-qc', 'match'], ['c1@quebec-qc', 'draft']]);
  });

  it('keeps an outcome while the answers stay the same and drops it when they change', () => {
    const checked = applyChatPlan([], 'c1', 'laval-qc', chat('laval-qc', full, match));
    // Reopened: the same answers without the request keep the window on the board.
    expect(applyChatPlan(checked, 'c1', 'laval-qc', chat('laval-qc', { ...full, when: 'pick' }))[0]).toMatchObject({
      status: 'match', start: '2027-06-19T15:00:00Z',
    });
    expect(applyChatPlan(checked, 'c1', 'laval-qc', chat('laval-qc', { ...full, duration: '3' }))[0]).toMatchObject({
      status: 'draft', durationHours: 3,
    });
    // Other conversations are never touched.
    const other = applyChatPlan(checked, 'c2', 'laval-qc', planFromChat('x', 'laval-qc', { ...NO_ANSWERS, activity: 'walking' }, null));
    expect(other.map(p => p.id)).toEqual(['c1@laval-qc', 'c2@laval-qc']);
  });

  it('turns plans still checking into drafts when another plan is reopened', () => {
    const checking = applyChatPlan([], 'c1', 'laval-qc', chat('laval-qc', full, { status: 'loading', request }));
    expect(stopChecking(checking, 'c2@laval-qc')[0]!.status).toBe('draft');
    expect(stopChecking(checking, 'c1@laval-qc')).toBe(checking);
  });
});

describe('localHour', () => {
  it('reads the hour in the city zone', () => {
    expect(localHour('2027-06-19T15:00:00Z', 'America/Toronto')).toBe(11);
    expect(localHour('2027-06-19T04:00:00Z', 'America/Toronto')).toBe(0);
    expect(localHour('2027-06-19T15:00:00Z', 'America/Vancouver')).toBe(8);
  });
});

describe('upsertPlan and removePlan', () => {
  const plan = (id: string, status: BoardPlan['status'] = 'draft'): BoardPlan => ({
    id, cityId: 'laval-qc', activity: 'hiking', date: null, durationHours: null, status, answers: NO_ANSWERS,
  });

  it('appends new plans and replaces existing ones in place', () => {
    const two = upsertPlan(upsertPlan([], plan('a')), plan('b'));
    expect(two.map(p => p.id)).toEqual(['a', 'b']);
    const updated = upsertPlan(two, plan('a', 'match'));
    expect(updated.map(p => [p.id, p.status])).toEqual([['a', 'match'], ['b', 'draft']]);
    expect(two[0]!.status).toBe('draft');
  });

  it('removes a plan by id and returns the same list when it is absent', () => {
    const list = [plan('a'), plan('b')];
    expect(removePlan(list, 'a').map(p => p.id)).toEqual(['b']);
    expect(removePlan(list, 'z')).toBe(list);
  });
});
