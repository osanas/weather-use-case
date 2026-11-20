import type { Activity, Thresholds } from './types';

/**
 * Server-owned threshold policy: the maximum precipitation probability and sustained wind
 * speed the planner applies to every hour of a window for an activity. Visitors never set
 * these values, and the API rejects threshold fields sent by a client.
 *
 * Returns `null` when no approved values exist for the activity; planning then reports
 * `planning_unavailable` instead of guessing.
 */
export type ThresholdPolicy = (activity: Activity) => Thresholds | null;

/**
 * Approved defaults for each activity.
 *
 * TODO(WEA-12): WEA-12 decides whether defaults are shared or vary by activity, defines the
 * values and documents the rationale. Until then no value is approved, so this policy
 * returns `null` for every activity and `POST /api/plan` returns `planning_unavailable`.
 * Do not add placeholder values here.
 */
export const approvedThresholdPolicy: ThresholdPolicy = () => null;

/**
 * Resolves the effective thresholds for an activity. A policy result that is not a valid
 * pair (precipitation 0–100 %, wind ≥ 0 km/h, both finite) is treated as undefined, so a
 * misconfigured policy can never reach the planner.
 */
export function resolveThresholds(policy: ThresholdPolicy, activity: Activity): Thresholds | null {
  const thresholds = policy(activity);
  if (!thresholds) return null;
  const { maxPrecipitationProbability: precipitation, maxWindKmh: wind } = thresholds;
  const valid = Number.isFinite(precipitation) && precipitation >= 0 && precipitation <= 100
    && Number.isFinite(wind) && wind >= 0;
  return valid ? { maxPrecipitationProbability: precipitation, maxWindKmh: wind } : null;
}
