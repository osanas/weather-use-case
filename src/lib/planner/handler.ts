import { readAgentConfig } from '@/lib/agent/config';
import { createGeminiModel } from '@/lib/agent/gemini';
import { createGroqModel, type ChatModel } from '@/lib/agent/groq';
import { runPlanningAgent, type AgentFailure } from '@/lib/agent/orchestrator';
import { findCity } from '@/lib/catalogue';
import { cityDisplayName, type City } from '@/lib/cities';
import type { ForecastCache } from '@/lib/weather/cache';
import { fetchForecast, ProviderError, type ProviderOutcome } from '@/lib/weather/open-meteo';
import { sharedForecastCache } from '@/lib/weather/handler';
import type { ProviderForecast } from '@/lib/weather/types';
import { parsePlanRequest } from './criteria';
import { planActivityWindow } from './planner';
import { approvedThresholdPolicy, resolveThresholds, type ThresholdPolicy } from './thresholds';
import type { PlanErrorBody, PlanResponse, PlanResult } from './types';

/** Request bodies above this size are rejected before parsing (product spec: 2 KiB). */
export const MAX_PLAN_BODY_BYTES = 2048;

/**
 * Only these fields may be logged. No bodies, criteria, headers, IPs, model text or keys.
 * `2xx` entries record an agent fallback: the response was still a rule-based result.
 */
export type PlanLogEntry = {
  route: 'plan';
  status: '2xx' | '4xx' | '5xx';
  outcome:
    | 'unsupported_media_type' | 'payload_too_large' | 'invalid_criteria' | ProviderOutcome
    | AgentFailure | 'result_mismatch';
  elapsedMs: number;
};

export type PlanHandlerDeps = {
  cache: ForecastCache;
  fetchForecast: (city: City) => Promise<ProviderForecast>;
  log: (entry: PlanLogEntry) => void;
  now: () => number;
  /** Server-owned thresholds per activity (WEA-12). */
  thresholds: ThresholdPolicy;
  /** Chat model for the agent path, or `null` when AI is disabled (rule-based only). */
  model: ChatModel | null;
  /** Overall agent deadline; defaults to the product-spec eight seconds. */
  agentDeadlineMs?: number;
};

/** The agent may only confirm the deterministic result; any difference means fallback. */
const sameResult = (a: PlanResult, b: PlanResult) => JSON.stringify(a) === JSON.stringify(b);

const NO_STORE = { 'Cache-Control': 'no-store' };

const errorResponse = (status: number, body: PlanErrorBody) =>
  Response.json(body, { status, headers: NO_STORE });

const INVALID_MESSAGE = 'Check the planning criteria and try again.';

/** Reads at most `limit` bytes of UTF-8 text. Returns `null` when the body is larger. */
async function readBodyWithin(request: Request, limit: number): Promise<string | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const isJson = (contentType: string | null) =>
  contentType !== null && contentType.split(';')[0]!.trim().toLowerCase() === 'application/json';

/**
 * `POST /api/plan`. Validates the request before any upstream work, loads the city's
 * public forecast (shared five-minute cache) and returns the deterministic planner result.
 *
 * Thresholds come from the server policy (the approved WEA-12 defaults per activity),
 * never from the request. If the policy yields no valid thresholds (a misconfiguration),
 * the response is `planning_unavailable` and no forecast is fetched.
 *
 * The deterministic planner always runs first and is the source of truth. When a model is
 * configured, the bounded agent (WEA-9) may request the read-only tools; the response is
 * labelled `agent` only if its `rank_windows` result equals the planner result. Any model
 * timeout, quota error, invalid tool call or invalid output falls back to the same planner
 * result labelled `rule-based`, so AI failures never break planning (AG-04).
 */
export function createPlanHandler(deps: PlanHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const startedAt = deps.now();
    const reject = (status: number, outcome: PlanLogEntry['outcome'], body: PlanErrorBody) => {
      deps.log({ route: 'plan', status: '4xx', outcome, elapsedMs: deps.now() - startedAt });
      return errorResponse(status, body);
    };

    if (!isJson(request.headers.get('content-type'))) {
      return reject(415, 'unsupported_media_type', {
        error: 'unsupported_media_type', message: 'Send the planning criteria as JSON.',
      });
    }

    let text: string | null;
    try {
      text = await readBodyWithin(request, MAX_PLAN_BODY_BYTES);
    } catch {
      return reject(400, 'invalid_criteria', { error: 'invalid_criteria', message: INVALID_MESSAGE, fields: ['body'] });
    }
    if (text === null) {
      return reject(413, 'payload_too_large', {
        error: 'payload_too_large', message: 'The planning request is too large.',
      });
    }

    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return reject(400, 'invalid_criteria', { error: 'invalid_criteria', message: INVALID_MESSAGE, fields: ['body'] });
    }

    const parsed = parsePlanRequest(input);
    if (!parsed.ok) {
      return reject(400, 'invalid_criteria', { error: 'invalid_criteria', message: INVALID_MESSAGE, fields: parsed.fields });
    }
    const city = findCity(parsed.request.cityId);
    if (!city) {
      return reject(400, 'invalid_criteria', { error: 'invalid_criteria', message: INVALID_MESSAGE, fields: ['cityId'] });
    }
    const thresholds = resolveThresholds(deps.thresholds, parsed.request.activity);
    if (!thresholds) {
      const unavailable: PlanResponse = { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' };
      return Response.json(unavailable, { headers: NO_STORE });
    }
    const criteria = { ...parsed.request, days: parsed.request.days ?? 1, ...thresholds };

    let forecast = deps.cache.get(city.id);
    if (!forecast) {
      try {
        forecast = await deps.fetchForecast(city);
        deps.cache.set(city.id, forecast);
      } catch (error) {
        deps.log({
          route: 'plan', status: '5xx',
          outcome: error instanceof ProviderError ? error.outcome : 'network',
          elapsedMs: deps.now() - startedAt,
        });
        return errorResponse(503, {
          error: 'weather_unavailable', message: 'Weather is temporarily unavailable. Try again.',
        });
      }
    }

    const planNow = deps.now();
    const result = planActivityWindow(forecast, criteria, planNow);
    if (result.outcome === 'outside_horizon') {
      // An out-of-horizon date is invalid input (HTTP 400), not a domain outcome.
      return reject(400, 'invalid_criteria', {
        error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'],
      });
    }

    if (deps.model) {
      const run = await runPlanningAgent({
        model: deps.model, forecast, criteria, cityName: cityDisplayName(city), now: planNow,
        deadlineMs: deps.agentDeadlineMs,
      });
      if (run.ok && sameResult(run.result, result)) {
        const agentBody: PlanResponse = { ...result, mode: 'agent' };
        return Response.json(agentBody, { headers: NO_STORE });
      }
      deps.log({
        route: 'plan', status: '2xx', outcome: run.ok ? 'result_mismatch' : run.reason,
        elapsedMs: deps.now() - startedAt,
      });
    }

    const body: PlanResponse = { ...result, mode: 'rule-based' };
    return Response.json(body, { headers: NO_STORE });
  };
}

export const defaultPlanHandler = createPlanHandler({
  cache: sharedForecastCache,
  fetchForecast: city => fetchForecast(city),
  log: entry => console.warn(JSON.stringify(entry)),
  now: Date.now,
  thresholds: approvedThresholdPolicy,
  // Server-only configuration: the key is read here and never logged or sent to the browser.
  model: (() => {
    const config = readAgentConfig(process.env);
    if (!config) return null;
    return config.provider === 'gemini' ? createGeminiModel(config) : createGroqModel(config);
  })(),
});
