import { planActivityWindow } from '@/lib/planner/planner';
import type { PlanCriteria, PlannerForecast, PlanResult } from '@/lib/planner/types';
import { ModelError, type ChatMessage, type ChatModel, type ModelOutcome } from './groq';
import { AGENT_TOOLS, dayForecastPayload, hasNoArguments, isToolName } from './tools';

/** Product-spec bounds for the agent path. */
export const AGENT_LIMITS = { maxTurns: 3, maxToolCalls: 2, deadlineMs: 8_000 } as const;

/** Why the agent path was abandoned. Safe to log: no payloads or model text. */
export type AgentFailure =
  | `model_${ModelOutcome}`
  | 'tool_rejected'
  | 'tool_limit'
  | 'turn_limit'
  | 'no_tool_result';

export type AgentRun =
  | { ok: true; result: PlanResult }
  | { ok: false; reason: AgentFailure };

export type AgentInput = {
  model: ChatModel;
  forecast: PlannerForecast;
  criteria: PlanCriteria;
  /** Catalogue display name, e.g. "Laval, Québec". */
  cityName: string;
  now: number;
  deadlineMs?: number;
};

const SYSTEM_PROMPT = [
  'You help plan an outdoor activity from a weather forecast.',
  'Call get_day_forecast first, then rank_windows. Both tools take no arguments;',
  'the server has already fixed the city, days, duration and limits.',
  'Do not invent times or weather values. After rank_windows, reply with one short sentence.',
].join(' ');

/** The user message is assembled by the server from validated values only (no free text). */
export function buildUserMessage(criteria: PlanCriteria, cityName: string): string {
  return JSON.stringify({
    city: cityName,
    activity: criteria.activity,
    date: criteria.date,
    days: criteria.days,
    durationHours: criteria.durationHours,
    maxPrecipitationProbability: criteria.maxPrecipitationProbability,
    maxWindKmh: criteria.maxWindKmh,
  });
}

/**
 * Bounded server orchestrator. The model may only request the two read-only tools, in
 * order, with no arguments, within three turns, two tool calls and an overall deadline.
 * The planner result comes from the `rank_windows` tool, never from model text, and is
 * returned only after a final turn without tool calls.
 */
export async function runPlanningAgent(input: AgentInput): Promise<AgentRun> {
  const { model, forecast, criteria, cityName, now, deadlineMs = AGENT_LIMITS.deadlineMs } = input;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const deadline = new Promise<AgentRun>(resolve => {
    controller.signal.addEventListener('abort', () => resolve({ ok: false, reason: 'model_timeout' }), { once: true });
  });

  const run = async (): Promise<AgentRun> => {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(criteria, cityName) },
    ];
    let toolCalls = 0;
    let forecastSent = false;
    let ranked: PlanResult | null = null;

    for (let turn = 0; turn < AGENT_LIMITS.maxTurns; turn++) {
      let reply;
      try {
        reply = await model.complete(messages, AGENT_TOOLS, controller.signal);
      } catch (error) {
        return { ok: false, reason: error instanceof ModelError ? `model_${error.outcome}` : 'model_invalid_response' };
      }
      if (controller.signal.aborted) return { ok: false, reason: 'model_timeout' };

      if (reply.toolCalls.length === 0) {
        // A final answer is accepted only after a valid ranking tool result.
        return ranked ? { ok: true, result: ranked } : { ok: false, reason: 'no_tool_result' };
      }
      if (reply.toolCalls.length > 1) return { ok: false, reason: 'tool_rejected' };
      toolCalls += 1;
      if (toolCalls > AGENT_LIMITS.maxToolCalls) return { ok: false, reason: 'tool_limit' };

      const call = reply.toolCalls[0]!;
      if (!isToolName(call.name) || !hasNoArguments(call.arguments)) return { ok: false, reason: 'tool_rejected' };

      let toolResult: unknown;
      if (call.name === 'get_day_forecast') {
        if (forecastSent) return { ok: false, reason: 'tool_rejected' };
        forecastSent = true;
        toolResult = dayForecastPayload(forecast, criteria, now);
      } else {
        // Ranking is available only after a successful forecast tool call, and only once.
        if (!forecastSent || ranked) return { ok: false, reason: 'tool_rejected' };
        ranked = planActivityWindow(forecast, criteria, now);
        // The model sees the outcome and figures, not the echoed criteria it already has.
        const { criteria: _echo, ...summary } = ranked;
        void _echo;
        toolResult = summary;
      }
      messages.push({ role: 'assistant', content: reply.content, toolCalls: [call] });
      messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(toolResult) });
    }
    return { ok: false, reason: 'turn_limit' };
  };

  try {
    return await Promise.race([run(), deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
