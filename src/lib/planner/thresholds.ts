import type { Activity, Thresholds } from './types';

/**
 * Server-owned threshold policy: the maximum precipitation probability and sustained wind
 * speed the planner applies to every hour of a window for an activity. Visitors never set
 * these values, and the API rejects threshold fields sent by a client.
 *
 * Returns `null` when no valid values exist for the activity; planning then reports
 * `planning_unavailable` instead of guessing.
 */
export type ThresholdPolicy = (activity: Activity) => Thresholds | null;

/**
 * Approved default maxima per activity (WEA-12, approved by the product owner). Inclusive,
 * applied to every hour of a window. Wind is the forecast sustained wind at 10 m for the
 * city centre. Rationale (see "Default activity thresholds" in docs/product-spec.md):
 *
 * - Cycling 20 % / 20 km/h: wet roads reduce braking and visibility, and wind affects effort
 *   and stability the most. 20 km/h is the start of Beaufort 4 (moderate breeze).
 * - Hiking 30 % / 30 km/h: longer outings away from shelter on trails that get slippery.
 *   30 km/h is the start of Beaufort 5 (fresh breeze); city-centre wind already understates
 *   exposed terrain.
 * - Walking 40 % / 35 km/h: short, flexible and close to shelter; buildings cut the wind.
 *
 * Change these values only through a reviewed product decision that also updates the spec.
 */
export const APPROVED_THRESHOLDS: Readonly<Record<Activity, Readonly<Thresholds>>> = Object.freeze({
  cycling: Object.freeze({ maxPrecipitationProbability: 20, maxWindKmh: 20 }),
  hiking: Object.freeze({ maxPrecipitationProbability: 30, maxWindKmh: 30 }),
  walking: Object.freeze({ maxPrecipitationProbability: 40, maxWindKmh: 35 }),
});

/** The production policy: the approved defaults for the requested activity. */
export const approvedThresholdPolicy: ThresholdPolicy = activity => APPROVED_THRESHOLDS[activity] ?? null;

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
