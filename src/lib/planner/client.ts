import type { PlanRequest } from './criteria';
import type { PlanCriteria, PlanMode, PlanResponse } from './types';

export const PLAN_UNAVAILABLE = 'Planning is temporarily unavailable. Try again.';

export type SubmitPlanResult =
  | { ok: true; data: PlanResponse }
  /** HTTP 400: the server rejected these criteria fields. */
  | { ok: false; kind: 'invalid'; fields: string[]; message: string }
  /** Network failure, 413/415/5xx or a malformed body. Retrying the same request may work. */
  | { ok: false; kind: 'unavailable'; message: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInstant = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const MODES: readonly PlanMode[] = ['agent', 'rule-based'];

/**
 * Shape check for a `POST /api/plan` 200 body. Rendered values (times, figures and the
 * effective thresholds) come only from fields checked here. The user-selected fields shown
 * are the ones the browser sent; the thresholds come from the server's `criteria`, since
 * only the server knows the policy.
 */
export function toPlanResponse(body: unknown, request: PlanRequest): PlanResponse | null {
  if (!isObj(body)) return null;
  if (body.outcome === 'planning_unavailable') {
    return { outcome: 'planning_unavailable', reason: 'thresholds_not_defined' };
  }
  if (!MODES.includes(body.mode as PlanMode)) return null;
  const mode = body.mode as PlanMode;
  const effective = isObj(body.criteria) ? body.criteria : null;
  if (!effective || !isNum(effective.maxPrecipitationProbability) || !isNum(effective.maxWindKmh)) return null;
  const criteria: PlanCriteria = {
    ...request,
    maxPrecipitationProbability: effective.maxPrecipitationProbability,
    maxWindKmh: effective.maxWindKmh,
  };
  switch (body.outcome) {
    case 'match':
      if (!isInstant(body.start) || !isInstant(body.end) || Date.parse(body.end) <= Date.parse(body.start)) return null;
      if (!isNum(body.maxPrecipitationProbability) || !isNum(body.maxWindKmh)) return null;
      return {
        outcome: 'match', mode, criteria,
        start: body.start, end: body.end,
        maxPrecipitationProbability: body.maxPrecipitationProbability, maxWindKmh: body.maxWindKmh,
      };
    case 'no_match':
      return { outcome: 'no_match', mode, criteria };
    case 'insufficient':
      return { outcome: 'insufficient', mode, criteria, reason: body.reason === 'stale' ? 'stale' : 'missing_data' };
    default:
      return null;
  }
}

/** Sends only the validated structured request fields to the same-origin planning API. */
export async function submitPlan(
  request: PlanRequest,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitPlanResult> {
  // Only the four user-selected fields; thresholds are resolved by the server.
  const { cityId, activity, date, durationHours } = request;
  try {
    const response = await fetchImpl('/api/plan', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ cityId, activity, date, durationHours }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 400 && isObj(body)) {
      const fields = Array.isArray(body.fields) ? body.fields.filter((f): f is string => typeof f === 'string') : [];
      const message = typeof body.message === 'string' ? body.message : 'Check the planning criteria and try again.';
      return { ok: false, kind: 'invalid', fields, message };
    }
    if (!response.ok) {
      const message = isObj(body) && typeof body.message === 'string' ? body.message : PLAN_UNAVAILABLE;
      return { ok: false, kind: 'unavailable', message };
    }
    const data = toPlanResponse(body, request);
    return data ? { ok: true, data } : { ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE };
  } catch {
    return { ok: false, kind: 'unavailable', message: PLAN_UNAVAILABLE };
  }
}
