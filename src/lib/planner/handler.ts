import { getCityById, type City } from '@/lib/cities';
import type { ForecastCache } from '@/lib/weather/cache';
import { fetchForecast, ProviderError, type ProviderOutcome } from '@/lib/weather/open-meteo';
import { sharedForecastCache } from '@/lib/weather/handler';
import type { ProviderForecast } from '@/lib/weather/types';
import { parsePlanCriteria } from './criteria';
import { planActivityWindow } from './planner';
import type { PlanErrorBody, PlanResponse } from './types';

/** Request bodies above this size are rejected before parsing (product spec: 2 KiB). */
export const MAX_PLAN_BODY_BYTES = 2048;

/** Only these fields may be logged. No bodies, criteria, headers or IPs. */
export type PlanLogEntry = {
  route: 'plan';
  status: '4xx' | '5xx';
  outcome: 'unsupported_media_type' | 'payload_too_large' | 'invalid_criteria' | ProviderOutcome;
  elapsedMs: number;
};

export type PlanHandlerDeps = {
  cache: ForecastCache;
  fetchForecast: (city: City) => Promise<ProviderForecast>;
  log: (entry: PlanLogEntry) => void;
  now: () => number;
};

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
 * WEA-8 scope: the result is always produced by the rule-based planner, so `mode` is
 * `rule-based`. The AI agent, `AI_ENABLED` handling and model fallback belong to WEA-9.
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

    const parsed = parsePlanCriteria(input);
    if (!parsed.ok) {
      return reject(400, 'invalid_criteria', { error: 'invalid_criteria', message: INVALID_MESSAGE, fields: parsed.fields });
    }
    const { criteria } = parsed;
    const city = getCityById(criteria.cityId)!;

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

    const result = planActivityWindow(forecast, criteria, deps.now());
    if (result.outcome === 'outside_horizon') {
      // An out-of-horizon date is invalid input (HTTP 400), not a domain outcome.
      return reject(400, 'invalid_criteria', {
        error: 'invalid_criteria', message: 'Choose a date within the forecast period.', fields: ['date'],
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
});
