import { describe, expect, it, vi } from 'vitest';
import { PLAN_UNAVAILABLE, submitPlan, toPlanResponse } from './client';
import type { PlanCriteria } from './types';

const criteria: PlanCriteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14',
  durationHours: 2, maxPrecipitationProbability: 30, maxWindKmh: 25,
};
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-14T15:00:00Z', end: '2027-06-14T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('toPlanResponse', () => {
  it('accepts the browser-contract match body and attaches the submitted criteria', () => {
    expect(toPlanResponse(match, criteria)).toEqual({ ...match, criteria });
  });

  it('accepts no_match and insufficient outcomes', () => {
    expect(toPlanResponse({ outcome: 'no_match', mode: 'agent' }, criteria)).toEqual({ outcome: 'no_match', mode: 'agent', criteria });
    expect(toPlanResponse({ outcome: 'insufficient', reason: 'stale', mode: 'rule-based' }, criteria))
      .toMatchObject({ outcome: 'insufficient', reason: 'stale' });
    expect(toPlanResponse({ outcome: 'insufficient', mode: 'rule-based' }, criteria))
      .toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
  });

  it('ignores extra fields and never copies them', () => {
    const result = toPlanResponse({ ...match, html: '<b>x</b>', explanation: 'model text' }, criteria);
    expect(result).not.toHaveProperty('html');
    expect(result).not.toHaveProperty('explanation');
  });

  it.each([
    ['unknown outcome', { ...match, outcome: 'maybe' }],
    ['unknown mode', { ...match, mode: 'magic' }],
    ['missing mode', { ...match, mode: undefined }],
    ['bad start', { ...match, start: 'soon' }],
    ['end before start', { ...match, end: '2027-06-14T14:00:00Z' }],
    ['non-numeric wind', { ...match, maxWindKmh: '12' }],
    ['null body', null],
    ['array body', [match]],
  ])('rejects %s', (_name, body) => {
    expect(toPlanResponse(body, criteria)).toBeNull();
  });
});

describe('submitPlan', () => {
  it('posts only the six structured fields as JSON to the same-origin route', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(match));
    await submitPlan({ ...criteria, extra: 'x' } as PlanCriteria, undefined, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/plan');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual(criteria);
  });

  it('returns field names from a 400 response', async () => {
    const fetchImpl = async () => json({ error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'] }, 400);
    expect(await submitPlan(criteria, undefined, fetchImpl)).toEqual({
      ok: false, kind: 'invalid', fields: ['date'], message: 'Choose a date within the forecast period.',
    });
  });

  it('reports 503, 413 and malformed bodies as unavailable', async () => {
    expect(await submitPlan(criteria, undefined, async () => json({ message: 'Weather is temporarily unavailable. Try again.' }, 503)))
      .toEqual({ ok: false, kind: 'unavailable', message: 'Weather is temporarily unavailable. Try again.' });
    expect(await submitPlan(criteria, undefined, async () => new Response('nope', { status: 413 })))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
    expect(await submitPlan(criteria, undefined, async () => json({ outcome: 'match' })))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
  });

  it('reports a network failure as unavailable', async () => {
    expect(await submitPlan(criteria, undefined, async () => { throw new TypeError('fetch failed'); }))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
  });
});
