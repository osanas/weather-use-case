import { describe, expect, it, vi } from 'vitest';
import type { City } from '@/lib/cities';
import { createForecastCache } from '@/lib/weather/cache';
import { ProviderError } from '@/lib/weather/open-meteo';
import { syntheticForecast } from '@/lib/weather/test-fixtures';
import type { HourlyPoint, LocalDay, ProviderForecast } from '@/lib/weather/types';
import { createPlanHandler, MAX_PLAN_BODY_BYTES, type PlanLogEntry } from './handler';
import * as plannerModule from './planner';
import { addCalendarDays, hourStartsOfDay } from './planner';
import { APPROVED_THRESHOLDS, approvedThresholdPolicy, type ThresholdPolicy } from './thresholds';
import type { Activity, Thresholds } from './types';

// Synthetic data only. Laval, EDT (UTC-4); provider midnights at 04:00Z.
const NOW = Date.parse('2027-06-14T12:00:00Z');
const HOUR_MS = 3_600_000;

const days: LocalDay[] = Array.from({ length: 7 }, (_, i) => {
  const start = Date.parse('2027-06-14T04:00:00Z') + i * 24 * HOUR_MS;
  return {
    date: addCalendarDays('2027-06-14', i),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 24 * HOUR_MS).toISOString(),
  };
});

function providerForecast(
  reading: (t: number) => [number | null, number | null] = () => [10, 12],
  fetchedAt = new Date(NOW).toISOString(),
): ProviderForecast {
  const hourly: HourlyPoint[] = days.flatMap(hourStartsOfDay).map(t => {
    const [precipitationProbability, windKmh] = reading(t);
    return { time: new Date(t).toISOString(), temperatureC: 18, precipitationProbability, windKmh, weatherCode: 0 };
  });
  return { ...syntheticForecast({ fetchedAt, hourly }), localDays: days };
}

/** Request body: the four user-selected fields. */
const criteria = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2 };

// Synthetic thresholds injected for tests only, deliberately different from the approved
// defaults (APPROVED_THRESHOLDS) so they are not mistaken for policy.
const SYNTHETIC: Thresholds = { maxPrecipitationProbability: 35, maxWindKmh: 28 };
const syntheticPolicy: ThresholdPolicy = () => SYNTHETIC;
/** Criteria the planner used: the request plus the resolved synthetic thresholds. */
const applied = { ...criteria, ...SYNTHETIC };

function setup(
  fetchForecast: (city: City) => Promise<ProviderForecast> = async () => providerForecast(),
  thresholds: ThresholdPolicy = syntheticPolicy,
) {
  const logs: PlanLogEntry[] = [];
  const fetchSpy = vi.fn(fetchForecast);
  const cache = createForecastCache({ now: () => NOW });
  const handler = createPlanHandler({
    cache, fetchForecast: fetchSpy, log: e => logs.push(e), now: () => NOW, thresholds,
  });
  const post = (body: BodyInit | null, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
    handler(new Request('http://localhost/api/plan', {
      method: 'POST', body, headers: { 'X-Forwarded-For': '203.0.113.7', ...headers },
      // Required by the Fetch spec for streamed bodies (no declared Content-Length).
      ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    } as RequestInit));
  const postJson = (value: unknown) => post(JSON.stringify(value));
  return { post, postJson, fetchSpy, logs, cache };
}

describe('POST /api/plan', () => {
  it('returns the best window from the deterministic planner, labelled rule-based, with no-store', async () => {
    const { postJson, fetchSpy } = setup(async () => providerForecast(t =>
      t === Date.parse('2027-06-14T15:00:00Z') || t === Date.parse('2027-06-14T16:00:00Z') ? [5, 10] : [10, 12]));
    const res = await postJson(criteria);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      outcome: 'match', mode: 'rule-based', criteria: applied,
      start: '2027-06-14T15:00:00.000Z', end: '2027-06-14T17:00:00.000Z',
      maxPrecipitationProbability: 5, maxWindKmh: 10,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0].id).toBe('laval-qc');
  });

  it('applies the resolved thresholds inclusively: 35 % and 28 km/h pass, 29 km/h fails', async () => {
    const at = (iso: string) => Date.parse(iso);
    const { postJson } = setup(async () => providerForecast(t =>
      t === at('2027-06-14T15:00:00Z') || t === at('2027-06-14T16:00:00Z') ? [35, 28]
        : t === at('2027-06-14T18:00:00Z') ? [0, 29] : [80, 40]));
    expect(await (await postJson(criteria)).json()).toMatchObject({
      outcome: 'match', start: '2027-06-14T15:00:00.000Z', maxPrecipitationProbability: 35, maxWindKmh: 28,
    });
  });

  describe('threshold policy', () => {
    it('returns planning_unavailable when the policy yields no thresholds, before any forecast fetch', async () => {
      const { postJson, fetchSpy, logs } = setup(undefined, () => null);
      const res = await postJson(criteria);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await res.json()).toEqual({ outcome: 'planning_unavailable', reason: 'thresholds_not_defined' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logs).toEqual([]);
    });

    it('uses the approved WEA-12 defaults for each activity with the production policy', async () => {
      const plan = vi.spyOn(plannerModule, 'planActivityWindow');
      const { postJson } = setup(undefined, approvedThresholdPolicy);
      for (const activity of ['hiking', 'cycling', 'walking'] as const) {
        const res = await postJson({ ...criteria, activity });
        const body = await res.json();
        expect(body.outcome).not.toBe('planning_unavailable');
        expect(body.criteria).toEqual({ ...criteria, activity, ...APPROVED_THRESHOLDS[activity] });
        expect(plan).toHaveBeenLastCalledWith(
          expect.anything(), { ...criteria, activity, ...APPROVED_THRESHOLDS[activity] }, NOW);
      }
      plan.mockRestore();
    });

    // Inclusive boundaries with the approved values: an hour exactly at both maxima passes,
    // one unit above either maximum fails.
    it.each([
      ['cycling', [20, 20], [21, 20], [20, 21]],
      ['hiking', [30, 30], [31, 30], [30, 31]],
      ['walking', [40, 35], [41, 35], [40, 36]],
    ] as const)('applies the approved %s maxima inclusively', async (activity, atLimit, rainAbove, windAbove) => {
      const at = (iso: string) => Date.parse(iso);
      const reading = (pair: readonly [number, number]) => (t: number) =>
        t === at('2027-06-14T15:00:00Z') || t === at('2027-06-14T16:00:00Z') ? [...pair] as [number, number] : [80, 60] as [number, number];
      const request = { ...criteria, activity };
      const run = async (pair: readonly [number, number]) => {
        const { postJson } = setup(async () => providerForecast(reading(pair)), approvedThresholdPolicy);
        return (await postJson(request)).json();
      };
      expect(await run(atLimit)).toMatchObject({
        outcome: 'match', start: '2027-06-14T15:00:00.000Z',
        maxPrecipitationProbability: atLimit[0], maxWindKmh: atLimit[1],
      });
      expect(await run(rainAbove)).toMatchObject({ outcome: 'no_match' });
      expect(await run(windAbove)).toMatchObject({ outcome: 'no_match' });
    });

    it('still rejects client-supplied thresholds with the production policy', async () => {
      const { postJson, fetchSpy } = setup(undefined, approvedThresholdPolicy);
      for (const extra of [{ maxWindKmh: 100 }, { maxPrecipitationProbability: 100 }]) {
        const res = await postJson({ ...criteria, ...extra });
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ fields: ['unknown_field'] });
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('still validates the request before reporting planning_unavailable', async () => {
      const { postJson } = setup(undefined, () => null);
      expect((await postJson({ ...criteria, durationHours: 9 })).status).toBe(400);
      expect((await postJson({ ...criteria, maxWindKmh: 50 })).status).toBe(400);
    });

    it('passes the resolved thresholds for the requested activity to the planner', async () => {
      const byActivity: Record<Activity, Thresholds> = {
        hiking: { maxPrecipitationProbability: 11, maxWindKmh: 22 },
        cycling: { maxPrecipitationProbability: 13, maxWindKmh: 14 },
        walking: { maxPrecipitationProbability: 37, maxWindKmh: 33 },
      };
      const policy = vi.fn<ThresholdPolicy>(activity => byActivity[activity]);
      const plan = vi.spyOn(plannerModule, 'planActivityWindow');
      const { postJson } = setup(undefined, policy);
      for (const activity of ['hiking', 'cycling', 'walking'] as const) {
        const res = await postJson({ ...criteria, activity });
        expect((await res.json()).criteria).toEqual({ ...criteria, activity, ...byActivity[activity] });
        expect(plan).toHaveBeenLastCalledWith(
          expect.anything(), { ...criteria, activity, ...byActivity[activity] }, NOW);
      }
      expect(policy.mock.calls.map(c => c[0])).toEqual(['hiking', 'cycling', 'walking']);
      plan.mockRestore();
    });

    it.each([
      ['a NaN wind limit', { maxPrecipitationProbability: 20, maxWindKmh: Number.NaN }],
      ['a precipitation limit over 100 %', { maxPrecipitationProbability: 120, maxWindKmh: 20 }],
      ['a negative wind limit', { maxPrecipitationProbability: 20, maxWindKmh: -1 }],
    ])('treats a policy returning %s as undefined', async (_name, thresholds) => {
      const { postJson, fetchSpy } = setup(undefined, () => thresholds);
      expect(await (await postJson(criteria)).json()).toMatchObject({ outcome: 'planning_unavailable' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('returns no_match with HTTP 200 when every window fails', async () => {
    const { postJson } = setup(async () => providerForecast(() => [80, 40]));
    const res = await postJson(criteria);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: 'no_match', mode: 'rule-based', criteria: applied });
  });

  it('returns insufficient with HTTP 200 when readings are missing', async () => {
    const { postJson } = setup(async () => providerForecast(() => [10, null]));
    const res = await postJson(criteria);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: 'insufficient', reason: 'missing_data', mode: 'rule-based', criteria: applied });
  });

  it('returns insufficient when the forecast is stale', async () => {
    const { postJson } = setup(async () => providerForecast(undefined, new Date(NOW - 5 * 60_000).toISOString()));
    expect(await (await postJson(criteria)).json()).toMatchObject({ outcome: 'insufficient', reason: 'stale' });
  });

  it('rejects a date outside the forecast horizon with 400 on the date field', async () => {
    const { postJson } = setup();
    for (const date of ['2027-06-13', '2027-06-21']) {
      const res = await postJson({ ...criteria, date });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'],
      });
    }
  });

  it.each([
    ['an unknown city', { ...criteria, cityId: 'unknown' }, ['cityId']],
    ['a five-hour duration', { ...criteria, durationHours: 5 }, ['durationHours']],
    ['an unknown field', { ...criteria, note: 'free text' }, ['unknown_field']],
    ['a client-supplied wind limit', { ...criteria, maxWindKmh: 200 }, ['unknown_field']],
    ['a client-supplied precipitation limit', { ...criteria, maxPrecipitationProbability: 100 }, ['unknown_field']],
    ['a non-object body', [criteria], ['body']],
  ])('rejects %s with 400 before any provider call', async (_name, body, fields) => {
    const { postJson, fetchSpy, logs } = setup();
    const res = await postJson(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_criteria', fields });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ route: 'plan', status: '4xx', outcome: 'invalid_criteria' });
  });

  it('rejects malformed JSON with 400', async () => {
    const { post, fetchSpy } = setup();
    const res = await post('{"cityId":');
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['no content type', {}],
    ['text/plain', { 'Content-Type': 'text/plain' }],
    ['form data', { 'Content-Type': 'application/x-www-form-urlencoded' }],
  ])('rejects %s with 415', async (_name, headers) => {
    const { post, fetchSpy } = setup();
    const res = await post(JSON.stringify(criteria), headers);
    expect(res.status).toBe(415);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a JSON content type with a charset parameter', async () => {
    const { post } = setup();
    const res = await post(JSON.stringify(criteria), { 'Content-Type': 'application/json; charset=utf-8' });
    expect(res.status).toBe(200);
  });

  it('rejects a body over 2 KiB with 413, by declared length or by bytes read', async () => {
    const big = JSON.stringify({ ...criteria, padding: 'x'.repeat(MAX_PLAN_BODY_BYTES) });
    const { post, fetchSpy } = setup();
    expect((await post(big)).status).toBe(413);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const res = await post(stream);
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a body of exactly 2 KiB', async () => {
    const base = JSON.stringify(criteria);
    // Pad with JSON whitespace to exactly the limit.
    const body = base.slice(0, -1) + ' '.repeat(MAX_PLAN_BODY_BYTES - base.length) + '}';
    expect(new TextEncoder().encode(body).byteLength).toBe(MAX_PLAN_BODY_BYTES);
    const { post } = setup();
    expect((await post(body)).status).toBe(200);
  });

  it('returns a safe 503 on provider failure and logs only allowlisted fields', async () => {
    const { postJson, logs } = setup(async () => { throw new ProviderError('timeout'); });
    const res = await postJson(criteria);
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.',
    });
    expect(Object.keys(logs[0]!).sort()).toEqual(['elapsedMs', 'outcome', 'route', 'status']);
    expect(logs[0]).toMatchObject({ route: 'plan', status: '5xx', outcome: 'timeout' });
  });

  it('hides unexpected error details', async () => {
    const { postJson, logs } = setup(async () => { throw new Error('secret stack detail'); });
    const res = await postJson(criteria);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('secret');
    expect(JSON.stringify(logs)).not.toContain('secret');
  });

  it('reuses a cached forecast and never caches failures', async () => {
    const fetchForecast = vi.fn<(city: City) => Promise<ProviderForecast>>()
      .mockRejectedValueOnce(new ProviderError('http_error'))
      .mockResolvedValue(providerForecast());
    const { postJson, fetchSpy } = setup(fetchForecast);
    expect((await postJson(criteria)).status).toBe(503);
    expect((await postJson(criteria)).status).toBe(200);
    expect((await postJson(criteria)).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('passes only the catalogue city to the provider and never logs criteria', async () => {
    const { postJson, fetchSpy, logs } = setup(async () => { throw new ProviderError('network'); });
    await postJson(criteria);
    expect(fetchSpy.mock.calls[0]![0]).toMatchObject({ id: 'laval-qc', timeZone: 'America/Toronto' });
    expect(JSON.stringify(logs)).not.toMatch(/hiking|2027-06-14|laval/);
  });
});
