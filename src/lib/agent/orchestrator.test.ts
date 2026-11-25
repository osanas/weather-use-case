import { describe, expect, it } from 'vitest';
import { planActivityWindow } from '@/lib/planner/planner';
import { ModelError, type AssistantTurn } from './groq';
import { AGENT_LIMITS, buildUserMessage, runPlanningAgent } from './orchestrator';
import { AGENT_CRITERIA, AGENT_NOW, agentForecast, call, HAPPY_SCRIPT, say, scriptedModel } from './test-support';
import { dayForecastPayload, hasNoArguments } from './tools';

const forecast = agentForecast();
const run = (turns: Parameters<typeof scriptedModel>[0], deadlineMs?: number) => {
  const fake = scriptedModel(turns);
  return {
    fake,
    result: runPlanningAgent({
      model: fake.model, forecast, criteria: AGENT_CRITERIA, cityName: 'Laval, Québec', now: AGENT_NOW, deadlineMs,
    }),
  };
};

describe('runPlanningAgent', () => {
  it('returns the planner result after forecast, ranking and a final turn', async () => {
    const { result, fake } = run(HAPPY_SCRIPT);
    expect(await result).toEqual({ ok: true, result: planActivityWindow(forecast, AGENT_CRITERIA, AGENT_NOW) });
    expect(fake.calls()).toBe(3);
    // The ranking tool result sent back to the model is the planner output.
    const toolMessage = fake.requests[2]!.messages.at(-1)!;
    expect(toolMessage).toMatchObject({ role: 'tool', toolCallId: 'call_rank_windows' });
    expect(JSON.parse((toolMessage as { content: string }).content)).toMatchObject({
      outcome: 'match', start: '2027-06-14T15:00:00.000Z', end: '2027-06-14T17:00:00.000Z',
    });
  });

  it('ignores times and values the model writes in its final text', async () => {
    const { result } = run([call('get_day_forecast'), call('rank_windows'), say('Go at 03:00, 0% rain, 0 km/h!')]);
    expect(await result).toMatchObject({ ok: true, result: { start: '2027-06-14T15:00:00.000Z', maxWindKmh: 10 } });
  });

  describe('rejects invalid tool use', () => {
    it.each<[string, AssistantTurn[]]>([
      ['an unsolicited ranking before the forecast', [call('rank_windows')]],
      ['an unknown tool', [call('fetch_url', '{"url":"https://example.com"}')]],
      ['an argument changing the city', [call('get_day_forecast', '{"cityId":"toronto-on"}')]],
      ['an argument changing the thresholds', [call('get_day_forecast'), call('rank_windows', '{"maxWindKmh":99}')]],
      ['malformed arguments', [call('get_day_forecast', '{not json')]],
      ['array arguments', [call('get_day_forecast', '[]')]],
      ['a repeated forecast call', [call('get_day_forecast'), call('get_day_forecast', '{}', 'call_2')]],
      ['parallel tool calls', [{ content: null, toolCalls: [
        { id: 'a', name: 'get_day_forecast', arguments: '{}' }, { id: 'b', name: 'rank_windows', arguments: '{}' },
      ] }]],
    ])('%s', async (_name, turns) => {
      expect(await run(turns).result).toEqual({ ok: false, reason: 'tool_rejected' });
    });

    it('stops after two tool calls', async () => {
      const { result } = run([call('get_day_forecast'), call('rank_windows'), call('rank_windows', '{}', 'call_3')]);
      expect(await result).toEqual({ ok: false, reason: 'tool_limit' });
    });

    it('rejects a final proposal with no valid tool result', async () => {
      expect(await run([say('Best time is 11:00 to 13:00.')]).result).toEqual({ ok: false, reason: 'no_tool_result' });
      expect(await run([call('get_day_forecast'), say('Try 11:00.')]).result).toEqual({ ok: false, reason: 'no_tool_result' });
    });

    it('allows at most three model turns', async () => {
      const fake = scriptedModel([call('get_day_forecast'), call('rank_windows'), call('rank_windows', '{}', 'x')]);
      await runPlanningAgent({ model: fake.model, forecast, criteria: AGENT_CRITERIA, cityName: 'Laval, Québec', now: AGENT_NOW });
      expect(fake.calls()).toBeLessThanOrEqual(AGENT_LIMITS.maxTurns);
    });
  });

  describe('model failures', () => {
    it.each(['timeout', 'quota', 'http_error', 'invalid_response', 'network'] as const)(
      'reports a %s model error', async outcome => {
        expect(await run([new ModelError(outcome)]).result).toEqual({ ok: false, reason: `model_${outcome}` });
      });

    it('treats an unexpected error as an invalid response', async () => {
      expect(await run([new Error('boom')]).result).toEqual({ ok: false, reason: 'model_invalid_response' });
    });

    it('enforces the overall deadline even if the model never answers', async () => {
      const started = Date.now();
      expect(await run(['hang'], 30).result).toEqual({ ok: false, reason: 'model_timeout' });
      expect(Date.now() - started).toBeLessThan(2_000);
    });

    it('uses the product-spec limits', () => {
      expect(AGENT_LIMITS).toEqual({ maxTurns: 3, maxToolCalls: 2, deadlineMs: 8_000 });
    });
  });

  describe('model input', () => {
    it('is built from validated values only', () => {
      expect(JSON.parse(buildUserMessage(AGENT_CRITERIA, 'Laval, Québec'))).toEqual({
        city: 'Laval, Québec', activity: 'hiking', date: '2027-06-14', days: 1, durationHours: 2,
        maxPrecipitationProbability: 35, maxWindKmh: 28,
      });
    });

    it('sends the minimum public forecast data for the requested day', async () => {
      const { result, fake } = run(HAPPY_SCRIPT);
      await result;
      const forecastResult = JSON.parse((fake.requests[1]!.messages.at(-1) as { content: string }).content);
      expect(Object.keys(forecastResult).sort()).toEqual(['date', 'days', 'hours']);
      for (const hour of forecastResult.hours) {
        expect(Object.keys(hour).sort()).toEqual(['precipitationProbability', 'start', 'windKmh']);
        expect(Date.parse(hour.start)).toBeGreaterThanOrEqual(AGENT_NOW);
      }
      // 12:00Z to 03:00Z next day: the future hours of 2027-06-14 in Laval.
      expect(forecastResult.hours).toHaveLength(16);
      const everything = JSON.stringify(fake.requests);
      for (const forbidden of ['latitude', 'longitude', 'temperature', 'fetchedAt', 'laval-qc', '203.0.113']) {
        expect(everything).not.toContain(forbidden);
      }
    });
  });
});

describe('tool helpers', () => {
  it('accepts only empty arguments', () => {
    expect(hasNoArguments('')).toBe(true);
    expect(hasNoArguments('{}')).toBe(true);
    expect(hasNoArguments(' { } ')).toBe(true);
    for (const raw of ['{"a":1}', '[]', 'null', '1', '"x"', '{']) expect(hasNoArguments(raw)).toBe(false);
  });

  it('returns no hours for a day the forecast does not cover', () => {
    expect(dayForecastPayload(forecast, { ...AGENT_CRITERIA, date: '2030-01-01' }, AGENT_NOW))
      .toEqual({ date: '2030-01-01', days: 1, hours: [] });
  });

  it('returns the future hours of the three searched days only, for a flexible search', () => {
    const payload = dayForecastPayload(forecast, { ...AGENT_CRITERIA, days: 3 }, AGENT_NOW);
    // 16 future hours today, then two full days of 24.
    expect(payload.hours).toHaveLength(16 + 24 + 24);
    expect(payload.hours[0]!.start).toBe('2027-06-14T12:00:00.000Z');
    expect(payload.hours.at(-1)!.start).toBe('2027-06-17T03:00:00.000Z');
    expect(payload.days).toBe(3);
  });
});
