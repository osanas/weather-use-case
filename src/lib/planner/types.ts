import type { ProviderForecast } from '@/lib/weather/types';

export const ACTIVITIES = ['hiking', 'cycling', 'walking'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/**
 * Validated planning criteria. The browser sends `cityId`, `activity`, `date` and
 * `durationHours`; the server adds the fixed comfort maxima (`COMFORT_LIMITS`).
 */
export type PlanCriteria = {
  cityId: string;
  activity: Activity;
  /** Requested local calendar date in the city's zone, YYYY-MM-DD. */
  date: string;
  /** Whole hours, 1–4. */
  durationHours: number;
  /** Inclusive maximum precipitation probability, 0–100 %. Fixed by the server. */
  maxPrecipitationProbability: number;
  /** Inclusive maximum sustained wind speed, km/h. Fixed by the server. */
  maxWindKmh: number;
};

/** The forecast fields the planner reads. Built server-side by `fetchForecast`. */
export type PlannerForecast = Pick<ProviderForecast, 'cityId' | 'fetchedAt' | 'hourly' | 'localDays'>;

/** A candidate window whose every hour was assessed and passed both maxima. */
export type ActivityWindow = {
  /** First hour start, ISO 8601 UTC. */
  start: string;
  /** End of the last hour, ISO 8601 UTC. */
  end: string;
  maxPrecipitationProbability: number;
  maxWindKmh: number;
};

/**
 * Planner outcome. Every result echoes the criteria used so the interface can show them.
 * - `match`: the best eligible window.
 * - `no_match`: the forecast covers the requested period and no window meets the criteria.
 * - `insufficient`: stale or missing data prevents a confident result.
 * - `outside_horizon`: the date is before today or beyond the forecast horizon (invalid input).
 */
export type PlanResult =
  | ({ outcome: 'match'; criteria: PlanCriteria } & ActivityWindow)
  | { outcome: 'no_match'; criteria: PlanCriteria }
  | { outcome: 'insufficient'; reason: 'stale' | 'missing_data'; criteria: PlanCriteria }
  | { outcome: 'outside_horizon'; criteria: PlanCriteria };

/** How the recommendation was produced. WEA-9 adds the `agent` path. */
export type PlanMode = 'agent' | 'rule-based';

/** Response body of a successful `POST /api/plan` (HTTP 200). */
export type PlanResponse = Exclude<PlanResult, { outcome: 'outside_horizon' }> & { mode: PlanMode };

/** Error body of `POST /api/plan`. `fields` names invalid criteria, never their values. */
export type PlanErrorBody = {
  error: 'invalid_criteria' | 'payload_too_large' | 'unsupported_media_type' | 'weather_unavailable';
  message: string;
  fields?: string[];
};
