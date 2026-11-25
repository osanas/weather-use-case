import type { ProviderForecast } from '@/lib/weather/types';

/**
 * Planning profiles, in the order Pico offers them. `other` is the profile for an activity the
 * visitor types: the typed name stays in the browser and only `other` is sent.
 */
export const ACTIVITIES = ['walking', 'errands', 'hiking', 'cycling', 'other'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/**
 * Effective planning criteria passed to the planner. The browser sends `cityId`,
 * `activity`, `date` and `durationHours`; the server adds the thresholds from its policy.
 */
export type PlanCriteria = {
  cityId: string;
  activity: Activity;
  /** Requested local calendar date in the city's zone, YYYY-MM-DD; the first day searched. */
  date: string;
  /** Consecutive local days searched from `date`, 1–3. */
  days: number;
  /** Whole hours, 1–4. */
  durationHours: number;
  /** Inclusive maximum precipitation probability, 0–100 %. Resolved by the server policy. */
  maxPrecipitationProbability: number;
  /** Inclusive maximum sustained wind speed, km/h. Resolved by the server policy. */
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

/** Threshold pair resolved by the server policy for an activity. */
export type Thresholds = Pick<PlanCriteria, 'maxPrecipitationProbability' | 'maxWindKmh'>;

/**
 * Response body of `POST /api/plan` with HTTP 200. Planner results echo the effective
 * criteria, thresholds included, so the interface can show the constraints used.
 * `planning_unavailable` means the server policy yielded no valid thresholds (a
 * misconfiguration, not a normal outcome), so the planner was not run and no forecast was
 * fetched.
 */
export type PlanResponse =
  | (Exclude<PlanResult, { outcome: 'outside_horizon' }> & { mode: PlanMode })
  | { outcome: 'planning_unavailable'; reason: 'thresholds_not_defined' };

/** Error body of `POST /api/plan`. `fields` names invalid criteria, never their values. */
export type PlanErrorBody = {
  error: 'invalid_criteria' | 'payload_too_large' | 'unsupported_media_type' | 'weather_unavailable';
  message: string;
  fields?: string[];
};
