import { localDateString } from '@/lib/forecast';
import type { HourlyPoint } from '@/lib/weather/types';
import { matchesAnswers, type Answers, type ChatRequest } from './conversation';
import { ACTIVITIES, type Activity, type Thresholds } from './types';

/**
 * One plan on the planning board, derived from Pico's conversation. The window and the
 * limits are copied from the planner's response as they are; nothing here judges the weather.
 */
export type BoardPlan = {
  id: string;
  cityId: string;
  activity: Activity;
  /** Local calendar date in the city's zone, or `null` while the day is not chosen. */
  date: string | null;
  durationHours: number | null;
  status: 'draft' | 'checking' | 'match' | 'no_match' | 'insufficient' | 'unavailable' | 'error';
  /** The planner's window, ISO 8601 UTC, for a `match`. */
  start?: string;
  end?: string;
  /** The limits the server applied, echoed by the planner result. */
  limits?: Thresholds;
  /** The conversation's answers, to reopen the plan in the chat. */
  answers: Answers;
};

/**
 * The board entry for the conversation's current answers and request, or `null` before an
 * activity is chosen. The request's outcome is used only when it was sent with exactly these
 * answers, so changing the day of a checked plan turns it back into a draft.
 */
export function planFromChat(
  id: string,
  cityId: string,
  answers: Answers,
  request: ChatRequest | null,
): BoardPlan | null {
  if (!ACTIVITIES.includes(answers.activity as Activity)) return null;
  const hours = Number(answers.duration);
  const plan: BoardPlan = {
    id,
    cityId,
    activity: answers.activity as Activity,
    date: answers.date || null,
    durationHours: Number.isInteger(hours) && hours > 0 ? hours : null,
    status: 'draft',
    answers,
  };
  if (!request || !matchesAnswers(request.request, answers)) return plan;
  if (request.status === 'loading') return { ...plan, status: 'checking' };
  if (request.status === 'error') return { ...plan, status: 'error' };
  const data = request.data;
  switch (data.outcome) {
    case 'match':
      return {
        ...plan, status: 'match', start: data.start, end: data.end,
        limits: { maxPrecipitationProbability: data.criteria.maxPrecipitationProbability, maxWindKmh: data.criteria.maxWindKmh },
      };
    case 'no_match':
      return {
        ...plan, status: 'no_match',
        limits: { maxPrecipitationProbability: data.criteria.maxPrecipitationProbability, maxWindKmh: data.criteria.maxWindKmh },
      };
    case 'insufficient': return { ...plan, status: 'insufficient' };
    case 'planning_unavailable': return { ...plan, status: 'unavailable' };
  }
}

/** Replaces the plan with the same id, or appends it; creation order is kept. */
export function upsertPlan(plans: readonly BoardPlan[], plan: BoardPlan): BoardPlan[] {
  const i = plans.findIndex(p => p.id === plan.id);
  if (i === -1) return [...plans, plan];
  const next = [...plans];
  next[i] = plan;
  return next;
}

/** Removes the plan with this id (used when its conversation is cleared before an activity). */
export function removePlan(plans: readonly BoardPlan[], id: string): BoardPlan[] {
  return plans.some(p => p.id === id) ? plans.filter(p => p.id !== id) : (plans as BoardPlan[]);
}

/** Board id of a conversation's plan in one city: a plan moved to another city is a new plan. */
export const boardId = (conversationId: string, cityId: string) => `${conversationId}@${cityId}`;
const conversationOf = (id: string) => id.slice(0, id.lastIndexOf('@'));

const sameAnswers = (a: Answers, b: Answers) =>
  a.activity === b.activity && a.date === b.date && a.duration.trim() === b.duration.trim();

/**
 * Applies the conversation's current plan to the board:
 * - the plan is stored under its conversation and city, so switching city keeps a checked plan
 *   where it was and starts a draft in the new city; drafts left in another city are dropped;
 * - a checked plan keeps its outcome while its answers stay the same (reopening a plan shows
 *   it as before until the visitor checks again); any change to them makes it a draft again;
 * - `null` (no activity) removes the plan.
 */
export function applyChatPlan(
  plans: readonly BoardPlan[],
  conversationId: string,
  cityId: string,
  plan: BoardPlan | null,
): BoardPlan[] {
  const id = boardId(conversationId, cityId);
  const kept = plans.filter(p => p.id === id || conversationOf(p.id) !== conversationId || p.status !== 'draft');
  if (!plan) return removePlan(kept, id);
  const stored = kept.find(p => p.id === id);
  if (stored && plan.status === 'draft' && stored.status !== 'draft' && stored.status !== 'checking' && sameAnswers(stored.answers, plan.answers)) {
    return kept;
  }
  return upsertPlan(kept, { ...plan, id, cityId });
}

/** Plans still marked as checking, except `keepId`, become drafts: their answer will not arrive. */
export function stopChecking(plans: readonly BoardPlan[], keepId: string | null): BoardPlan[] {
  if (!plans.some(p => p.status === 'checking' && p.id !== keepId)) return plans as BoardPlan[];
  return plans.map(p => (p.status === 'checking' && p.id !== keepId ? { ...p, status: 'draft' } : p));
}

/** The conversation a board plan belongs to. */
export const conversationIdOf = conversationOf;

/** Local hour (0–23) at which an instant falls in the city's zone. */
export function localHour(iso: string, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(Date.parse(iso)));
}

/**
 * The hourly points whose start falls on this local date in the city's zone. A local day has
 * 23, 24 or 25 hours across daylight-saving changes; grouping by instant keeps each one.
 */
export function hoursOfDay(hourly: readonly HourlyPoint[], date: string, timeZone: string): HourlyPoint[] {
  return hourly.filter(h => localDateString(Date.parse(h.time), timeZone) === date);
}

/** Whether an hour starting at `hourStart` lies in the window: `start` inclusive, `end` exclusive. */
export function inWindow(hourStart: string, start: string, end: string): boolean {
  const t = Date.parse(hourStart);
  return t >= Date.parse(start) && t < Date.parse(end);
}
