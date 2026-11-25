import { searchedDates } from '@/lib/planner/planner';
import type { PlanCriteria, PlannerForecast } from '@/lib/planner/types';
import type { ToolDefinition } from './groq';

/** The only tools the model may request. Both are read-only and take no arguments. */
export const AGENT_TOOLS = [
  {
    name: 'get_day_forecast',
    description: 'Returns the hourly precipitation probability and sustained wind for the requested days. Takes no arguments.',
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
 * Minimum public forecast data for the model: the future hours of the requested local days
 * (one, or up to three for "I'm flexible"), as UTC instants with precipitation probability and
 * sustained wind only. No temperature, coordinates, identifiers or visitor data.
 */
export function dayForecastPayload(forecast: PlannerForecast, criteria: PlanCriteria, now: number) {
  const dates = searchedDates(criteria);
  const days = forecast.localDays.filter(d => dates.includes(d.date));
  const hours = forecast.hourly
    .filter(point => {
      const t = Date.parse(point.time);
      return t >= now && days.some(day => t >= Date.parse(day.startsAt) && t < Date.parse(day.endsAt));
    })
    .map(point => ({
      start: point.time,
      precipitationProbability: point.precipitationProbability,
      windKmh: point.windKmh,
    }));
  return { date: criteria.date, days: criteria.days, hours };
}
