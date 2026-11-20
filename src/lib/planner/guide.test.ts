import { describe, expect, it } from 'vitest';
import type { PlanRequest } from './criteria';
import { EMPTY_FORM, type PlanFormValues } from './form';
import { guidePrompt, type GuideRequest, type GuideState } from './guide';
import type { PlanCriteria, PlanResponse } from './types';

// Synthetic state only. The thresholds below are test values, not the approved defaults.
const bounds = { min: '2027-06-14', max: '2027-06-20' };
const filled: PlanFormValues = { activity: 'hiking', date: '2027-06-14', durationHours: '2' };
const request: PlanRequest = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2 };
const criteria: PlanCriteria = { ...request, maxPrecipitationProbability: 35, maxWindKmh: 28 };

const state = (overrides: Partial<GuideState> = {}): GuideState => ({
  cityName: 'Laval, Québec', values: EMPTY_FORM, errors: {}, bounds, request: null, ...overrides,
});
const done = (data: PlanResponse): GuideRequest => ({ status: 'done', request, data });

const RESPONSES: Record<string, PlanResponse> = {
  match: {
    outcome: 'match', mode: 'rule-based', start: '2027-06-14T15:00:00Z', end: '2027-06-14T17:00:00Z',
    maxPrecipitationProbability: 10, maxWindKmh: 12, criteria,
  },
  no_match: { outcome: 'no_match', mode: 'rule-based', criteria },
  insufficient: { outcome: 'insufficient', reason: 'stale', mode: 'agent', criteria },
  unavailable: { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' },
};

describe('guidePrompt', () => {
  it('walks through the missing fields in form order', () => {
    const activity = guidePrompt(state());
    expect(activity).toMatchObject({ step: 'activity', mood: 'hello', announce: true });
    expect(activity.text).toContain('Laval, Québec');

    const date = guidePrompt(state({ values: { ...EMPTY_FORM, activity: 'cycling' } }));
    expect(date).toMatchObject({ step: 'date', announce: true });
    expect(date.text).toBe('Cycling it is! Which day? Pick a date up to Sun, Jun 20.');

    expect(guidePrompt(state({ values: { ...filled, durationHours: ' ' } })).step).toBe('duration');
    expect(guidePrompt(state({ values: filled }))).toMatchObject({ step: 'ready', announce: true });
  });

  it('asks for a date without a bound before the client clock is known', () => {
    const prompt = guidePrompt(state({ values: { ...EMPTY_FORM, activity: 'walking' }, bounds: null }));
    expect(prompt.text).toBe('Walking it is! Which day? Pick a date in the coming week.');
  });

  it('treats an unknown activity value as missing', () => {
    expect(guidePrompt(state({ values: { ...filled, activity: 'swimming' } })).step).toBe('activity');
  });

  it('keeps the same prompt while a duration is typed', () => {
    const prompts = ['1', '12', '3'].map(d => guidePrompt(state({ values: { ...filled, durationHours: d } })));
    expect(new Set(prompts.map(p => p.text)).size).toBe(1);
  });

  it('points to the first field error in form order, quietly', () => {
    const prompt = guidePrompt(state({
      values: filled, errors: { durationHours: 'x', date: 'y' }, request: done(RESPONSES.match!),
    }));
    expect(prompt).toMatchObject({ step: 'fix-date', mood: 'unsure', announce: false });
    expect(prompt.text).toContain('the date');
    expect(guidePrompt(state({ errors: { form: 'x' } })).step).toBe('fix-form');
    expect(guidePrompt(state({ errors: { cityId: 'x' } })).step).toBe('fix-form');
  });

  it('reacts to loading, errors and every result without repeating its announcement', () => {
    const cases: [GuideRequest, string][] = [
      [{ status: 'loading', request }, 'loading'],
      [{ status: 'error', request, message: 'Planning is temporarily unavailable.' }, 'error'],
      [done(RESPONSES.match!), 'match'],
      [done(RESPONSES.no_match!), 'no_match'],
      [done(RESPONSES.insufficient!), 'insufficient'],
      [done(RESPONSES.unavailable!), 'unavailable'],
    ];
    for (const [req, step] of cases) {
      const prompt = guidePrompt(state({ values: filled, request: req }));
      expect(prompt.step).toBe(step);
      expect(prompt.announce).toBe(false);
      // Times and figures belong to the planner result, never to the guide.
      expect(prompt.text).not.toMatch(/\d+\s*%|km\/h|\d{1,2}:\d{2}/);
    }
    expect(guidePrompt(state({ values: filled, request: done(RESPONSES.match!) })).mood).toBe('happy');
  });

  it('shows the loading reaction even if a field changes during the request', () => {
    const prompt = guidePrompt(state({ values: { ...filled, durationHours: '' }, request: { status: 'loading', request } }));
    expect(prompt.step).toBe('loading');
  });

  it('returns to the form prompts once the fields no longer match the result', () => {
    const result = done(RESPONSES.no_match!);
    expect(guidePrompt(state({ values: { ...filled, date: '2027-06-15' }, request: result })).step).toBe('ready');
    expect(guidePrompt(state({ values: { ...filled, durationHours: '' }, request: result })).step).toBe('duration');
    expect(guidePrompt(state({ values: { ...filled, durationHours: ' 2 ' }, request: result })).step).toBe('no_match');
  });
});
