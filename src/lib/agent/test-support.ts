// Synthetic fixtures and fake models for agent tests only. Not imported by application code.
import { addCalendarDays, hourStartsOfDay } from '@/lib/planner/planner';
import type { PlanCriteria } from '@/lib/planner/types';
import { syntheticForecast } from '@/lib/weather/test-fixtures';
import type { HourlyPoint, LocalDay, ProviderForecast } from '@/lib/weather/types';
import type { AssistantTurn, ChatMessage, ChatModel, ToolDefinition } from './groq';

/** 2027-06-14T12:00Z: 08:00 EDT in Laval. */
export const AGENT_NOW = Date.parse('2027-06-14T12:00:00Z');
const HOUR_MS = 3_600_000;

export const LAVAL_DAYS: LocalDay[] = Array.from({ length: 7 }, (_, i) => {
  const start = Date.parse('2027-06-14T04:00:00Z') + i * 24 * HOUR_MS;
  return {
    date: addCalendarDays('2027-06-14', i),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 24 * HOUR_MS).toISOString(),
  };
});

/** Laval forecast: every hour 80 %/40 km/h except 15:00Z and 16:00Z (dry and calm). */
export function agentForecast(fetchedAt = new Date(AGENT_NOW).toISOString()): ProviderForecast {
  const good = new Set([Date.parse('2027-06-14T15:00:00Z'), Date.parse('2027-06-14T16:00:00Z')]);
  const hourly: HourlyPoint[] = LAVAL_DAYS.flatMap(hourStartsOfDay).map(t => ({
    time: new Date(t).toISOString(),
    temperatureC: 18,
    precipitationProbability: good.has(t) ? 5 : 80,
    windKmh: good.has(t) ? 10 : 40,
    weatherCode: 0,
  }));
  return { ...syntheticForecast({ fetchedAt, hourly }), localDays: LAVAL_DAYS };
}

/** Effective criteria with synthetic thresholds (not the approved defaults). */
export const AGENT_CRITERIA: PlanCriteria = {
  cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', days: 1, durationHours: 2,
  maxPrecipitationProbability: 35, maxWindKmh: 28,
};

export const call = (name: string, args = '{}', id = `call_${name}`): AssistantTurn =>
  ({ content: null, toolCalls: [{ id, name, arguments: args }] });
export const say = (content: string): AssistantTurn => ({ content, toolCalls: [] });

/** The expected well-behaved conversation: forecast, rank, final sentence. */
export const HAPPY_SCRIPT: AssistantTurn[] = [call('get_day_forecast'), call('rank_windows'), say('Done.')];

/** A fake model that replays turns and records every request it receives. */
export function scriptedModel(turns: readonly (AssistantTurn | Error | 'hang')[]) {
  const requests: { messages: ChatMessage[]; tools: ToolDefinition[] }[] = [];
  let index = 0;
  const model: ChatModel = {
    complete(messages, tools, signal) {
      requests.push({ messages: structuredClone([...messages]), tools: [...tools] });
      const next = turns[Math.min(index++, turns.length - 1)]!;
      if (next === 'hang') {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        });
      }
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
  return { model, requests, calls: () => requests.length };
}
