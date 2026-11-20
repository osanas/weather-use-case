import type { PlanCriteria, PlannerForecast } from '@/lib/planner/types';
import type { ToolDefinition } from './groq';

/** The only tools the model may request. Both are read-only and take no arguments. */
export const AGENT_TOOLS = [
  {
    name: 'get_day_forecast',
    description: 'Returns the hourly precipitation probability and sustained wind for the requested day. Takes no arguments.',
  },
  {
    name: 'rank_windows',
    description: 'Runs the planner on that forecast and returns the best eligible window. Call after get_day_forecast. Takes no arguments.',
  },
] as const satisfies readonly ToolDefinition[];

export type ToolName = (typeof AGENT_TOOLS)[number]['name'];

export function isToolName(name: string): name is ToolName {
  return AGENT_TOOLS.some(tool => tool.name === name);
}

/**
 * Tool arguments must be an empty JSON object (or empty). Any field, such as an attempt to
 * change the city, date, duration or thresholds, makes the call invalid.
 */
export function hasNoArguments(raw: string): boolean {
  if (raw.trim() === '') return true;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
  } catch {
    return false;
  }
}

/**
 * Minimum public forecast data for the model: the future hours of the requested local day,
 * as UTC instants with precipitation probability and sustained wind only. No temperature,
 * coordinates, identifiers or visitor data.
 */
export function dayForecastPayload(forecast: PlannerForecast, criteria: PlanCriteria, now: number) {
  const day = forecast.localDays.find(d => d.date === criteria.date);
  if (!day) return { date: criteria.date, hours: [] };
  const start = Date.parse(day.startsAt);
  const end = Date.parse(day.endsAt);
  const hours = forecast.hourly
    .filter(point => {
      const t = Date.parse(point.time);
      return t >= start && t < end && t >= now;
    })
    .map(point => ({
      start: point.time,
      precipitationProbability: point.precipitationProbability,
      windKmh: point.windKmh,
    }));
  return { date: criteria.date, hours };
}
