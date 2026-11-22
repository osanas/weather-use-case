import { describe, expect, it, vi } from 'vitest';
import { createGeminiModel } from '@/lib/agent/gemini';
import { createGroqModel, ModelError, type ChatModel } from '@/lib/agent/groq';
import { AGENT_NOW, agentForecast, call, HAPPY_SCRIPT, say, scriptedModel } from '@/lib/agent/test-support';
import type { City } from '@/lib/cities';
import { createForecastCache } from '@/lib/weather/cache';
import { ProviderError } from '@/lib/weather/open-meteo';
import type { ProviderForecast } from '@/lib/weather/types';
import { createPlanHandler, type PlanLogEntry } from './handler';
import type { ThresholdPolicy } from './thresholds';

// Server integration tests for the agent path and the rule-based fallback, using the real
// plan handler with a fake model. Synthetic data and placeholder credentials only.

const SYNTHETIC: ThresholdPolicy = () => ({ maxPrecipitationProbability: 35, maxWindKmh: 28 });
const request = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2 };
const expectedWindow = {
  outcome: 'match', start: '2027-06-14T15:00:00.000Z', end: '2027-06-14T17:00:00.000Z',
  maxPrecipitationProbability: 5, maxWindKmh: 10,
};

function setup(model: ChatModel | null, options: {
  fetchForecast?: (city: City) => Promise<ProviderForecast>;
  agentDeadlineMs?: number;
} = {}) {
  const logs: PlanLogEntry[] = [];
  const fetchSpy = vi.fn(options.fetchForecast ?? (async () => agentForecast()));
  const handler = createPlanHandler({
    cache: createForecastCache({ now: () => AGENT_NOW }),
    fetchForecast: fetchSpy,
    log: entry => logs.push(entry),
    now: () => AGENT_NOW,
    thresholds: SYNTHETIC,
    model,
    agentDeadlineMs: options.agentDeadlineMs,
  });
  const post = async (body: unknown = request) => {
    const res = await handler(new Request('http://localhost/api/plan', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7', 'User-Agent': 'synthetic-agent' },
    }));
    return { status: res.status, cache: res.headers.get('Cache-Control'), body: await res.json() };
  };
  return { post, logs, fetchSpy };
}

describe('POST /api/plan with the agent', () => {
  it('labels the planner result as agent after valid tool use', async () => {
    const { model, calls } = scriptedModel(HAPPY_SCRIPT);
    const { post, logs } = setup(model);
    const res = await post();
    expect(res).toMatchObject({ status: 200, cache: 'no-store' });
    expect(res.body).toMatchObject({ ...expectedWindow, mode: 'agent' });
    expect(calls()).toBe(3);
    expect(logs).toEqual([]);
  });

  it('returns the same times and values in agent and rule-based modes', async () => {
    const agent = await setup(scriptedModel(HAPPY_SCRIPT).model).post();
    const rule = await setup(null).post();
    const { mode: agentMode, ...agentRest } = agent.body;
    const { mode: ruleMode, ...ruleRest } = rule.body;
    expect([agentMode, ruleMode]).toEqual(['agent', 'rule-based']);
    expect(agentRest).toEqual(ruleRest);
  });

  it('stays rule-based with no model call when AI is disabled', async () => {
    const { post, logs } = setup(null);
    expect((await post()).body).toMatchObject({ ...expectedWindow, mode: 'rule-based' });
    expect(logs).toEqual([]);
  });

  describe('falls back to the rule-based result', () => {
    it('on a model timeout at the server boundary', async () => {
      const { model } = scriptedModel(['hang']);
      const { post, logs } = setup(model, { agentDeadlineMs: 30 });
      const res = await post();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ...expectedWindow, mode: 'rule-based' });
      expect(logs).toEqual([{ route: 'plan', status: '2xx', outcome: 'model_timeout', elapsedMs: 0 }]);
    });

    it.each([
      ['a quota error', [new ModelError('quota')], 'model_quota'],
      ['a provider error', [new ModelError('http_error')], 'model_http_error'],
      ['invalid model output', [new ModelError('invalid_response')], 'model_invalid_response'],
      ['an unsolicited tool call', [call('rank_windows')], 'tool_rejected'],
      ['invalid tool arguments', [call('get_day_forecast', '{"date":"2027-06-15"}')], 'tool_rejected'],
      ['an unknown tool', [call('send_email')], 'tool_rejected'],
      ['a proposal with no valid tool result', [say('Go at 11:00.')], 'no_tool_result'],
      ['too many tool calls', [call('get_day_forecast'), call('rank_windows'), call('rank_windows', '{}', 'x')], 'tool_limit'],
    ] as const)('on %s', async (_name, turns, outcome) => {
      const { post, logs } = setup(scriptedModel(turns).model);
      const res = await post();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ...expectedWindow, mode: 'rule-based' });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ route: 'plan', status: '2xx', outcome });
      expect(Object.keys(logs[0]!).sort()).toEqual(['elapsedMs', 'outcome', 'route', 'status']);
    });

    it('for no-match and insufficient results too', async () => {
      const wet = async () => {
        const f = agentForecast();
        return { ...f, hourly: f.hourly.map(h => ({ ...h, precipitationProbability: 90 })) };
      };
      const { post } = setup(scriptedModel([new ModelError('timeout')]).model, { fetchForecast: wet });
      expect((await post()).body).toMatchObject({ outcome: 'no_match', mode: 'rule-based' });
    });
  });

  it('keeps forecast failures as a 503 without calling the model', async () => {
    const { model, calls } = scriptedModel(HAPPY_SCRIPT);
    const { post } = setup(model, { fetchForecast: async () => { throw new ProviderError('timeout'); } });
    expect((await post()).status).toBe(503);
    expect(calls()).toBe(0);
  });

  it('does not call the model for invalid requests', async () => {
    const { model, calls } = scriptedModel(HAPPY_SCRIPT);
    const { post } = setup(model);
    expect((await post({ ...request, maxWindKmh: 99 })).status).toBe(400);
    expect((await post({ ...request, date: '2027-06-30' })).status).toBe(400);
    expect(calls()).toBe(0);
  });

  it.each([
    ['Groq', (f: typeof fetch) => createGroqModel({ provider: 'groq', apiKey: 'test-placeholder-key', model: 'test-model' }, f)],
    ['Gemini', (f: typeof fetch) => createGeminiModel({ provider: 'gemini', apiKey: 'test-placeholder-key', model: 'test-model' }, f)],
  ])('sends %s only validated values and public forecast data, never visitor data', async (_name, createModel) => {
    const bodies: string[] = [];
    const turns = [...HAPPY_SCRIPT];
    let turn = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      bodies.push(init?.body as string);
      const next = turns[turn++]!;
      return new Response(JSON.stringify({ choices: [{ message: {
        content: next.content,
        ...(next.toolCalls.length ? { tool_calls: next.toolCalls.map(c => ({
          id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments },
        })) } : {}),
      } }] }), { headers: { 'Content-Type': 'application/json' } });
    });
    const model = createModel(fetchImpl);
    const { post } = setup(model);
    expect((await post()).body.mode).toBe('agent');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const init of fetchImpl.mock.calls.map(c => c[1]!)) {
      expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual(['Accept', 'Authorization', 'Content-Type']);
    }
    const all = bodies.join('\n');
    for (const forbidden of ['203.0.113.7', 'synthetic-agent', 'X-Forwarded-For', 'User-Agent', 'latitude', 'longitude', 'test-placeholder-key']) {
      expect(all).not.toContain(forbidden);
    }
    const first = JSON.parse(bodies[0]!);
    expect(first.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect(JSON.parse(first.messages[1].content)).toEqual({
      city: 'Laval, Québec', activity: 'hiking', date: '2027-06-14', durationHours: 2,
      maxPrecipitationProbability: 35, maxWindKmh: 28,
    });
  });
});
