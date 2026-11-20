import { describe, expect, it, vi } from 'vitest';
import { PLAN_UNAVAILABLE, submitPlan, toPlanResponse } from './client';
import type { PlanRequest } from './criteria';

const request: PlanRequest = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2 };
// Synthetic thresholds for tests only, not approved defaults (WEA-12 defines those).
const effective = { ...request, maxPrecipitationProbability: 35, maxWindKmh: 28 };
const match = {
  outcome: 'match', mode: 'rule-based', start: '2027-06-14T15:00:00Z', end: '2027-06-14T17:00:00Z',
  maxWindKmh: 12, maxPrecipitationProbability: 10, criteria: effective,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('toPlanResponse', () => {
  it('takes the effective thresholds from the server and the user fields from the request', () => {
    expect(toPlanResponse(match, request)).toEqual({ ...match, criteria: effective });
    // The server cannot swap the user-selected fields, only report its thresholds.
    const swapped = { ...match, criteria: { ...effective, cityId: 'toronto-on', date: '2027-06-15' } };
    expect(toPlanResponse(swapped, request)).toMatchObject({
      criteria: { cityId: 'laval-qc', date: '2027-06-14', maxPrecipitationProbability: 35, maxWindKmh: 28 },
    });
  });

  it('accepts no_match and insufficient outcomes', () => {
    expect(toPlanResponse({ outcome: 'no_match', mode: 'agent', criteria: effective }, request))
      .toEqual({ outcome: 'no_match', mode: 'agent', criteria: effective });
    expect(toPlanResponse({ outcome: 'insufficient', reason: 'stale', mode: 'rule-based', criteria: effective }, request))
      .toMatchObject({ outcome: 'insufficient', reason: 'stale' });
    expect(toPlanResponse({ outcome: 'insufficient', mode: 'rule-based', criteria: effective }, request))
      .toMatchObject({ outcome: 'insufficient', reason: 'missing_data' });
  });

  it('accepts planning_unavailable without mode or criteria', () => {
    expect(toPlanResponse({ outcome: 'planning_unavailable', reason: 'thresholds_not_defined' }, request))
      .toEqual({ outcome: 'planning_unavailable', reason: 'thresholds_not_defined' });
  });

  it('ignores extra fields and never copies them', () => {
    const result = toPlanResponse({ ...match, html: '<b>x</b>', explanation: 'model text' }, request);
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
    ['missing effective criteria', { ...match, criteria: undefined }],
    ['missing effective wind limit', { ...match, criteria: { ...effective, maxWindKmh: undefined } }],
    ['non-numeric precipitation limit', { ...match, criteria: { ...effective, maxPrecipitationProbability: '35' } }],
    ['null body', null],
    ['array body', [match]],
  ])('rejects %s', (_name, body) => {
    expect(toPlanResponse(body, request)).toBeNull();
  });
});

describe('submitPlan', () => {
  it('posts only the four user-selected fields as JSON, never thresholds', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(match));
    await submitPlan({ ...effective, extra: 'x' } as PlanRequest, undefined, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/plan');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2,
    });
  });

  it('returns field names from a 400 response', async () => {
    const fetchImpl = async () => json({ error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'] }, 400);
    expect(await submitPlan(request, undefined, fetchImpl)).toEqual({
      ok: false, kind: 'invalid', fields: ['date'], message: 'Choose a date within the forecast period.',
    });
  });

  it('reports 503, 413 and malformed bodies as unavailable', async () => {
    expect(await submitPlan(request, undefined, async () => json({ message: 'Weather is temporarily unavailable. Try again.' }, 503)))
      .toEqual({ ok: false, kind: 'unavailable', message: 'Weather is temporarily unavailable. Try again.' });
    expect(await submitPlan(request, undefined, async () => new Response('nope', { status: 413 })))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
    expect(await submitPlan(request, undefined, async () => json({ outcome: 'match' })))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
  });

  it('reports a network failure as unavailable', async () => {
    expect(await submitPlan(request, undefined, async () => { throw new TypeError('fetch failed'); }))
      .toEqual({ ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE });
  });
});
