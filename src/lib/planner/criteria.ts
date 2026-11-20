import { z } from 'zod';
import { getCityById } from '@/lib/cities';
import { ACTIVITIES } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real Gregorian calendar date in YYYY-MM-DD form (rejects 2027-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Static shape and range checks for the `POST /api/plan` body: the user-selected fields
 * only. Thresholds come from the server policy (`thresholds.ts`), so a threshold field is
 * an unknown field. The forecast horizon depends on the city's current local day, so the
 * planner checks it against the provider's day boundaries.
 */
export const planRequestSchema = z
  .object({
    cityId: z.string().refine(id => getCityById(id) !== undefined, 'Unknown city.'),
    activity: z.enum(ACTIVITIES),
    date: z.string().refine(isCalendarDate, 'Date must be a valid YYYY-MM-DD date.'),
    durationHours: z.number().int().min(1).max(4),
  })
  .strict();

export type PlanRequest = z.infer<typeof planRequestSchema>;

export type ParseRequestResult =
  | { ok: true; request: PlanRequest }
  | { ok: false; fields: string[] };

/** Validates untrusted planning input. Errors list field names only, never input values. */
export function parsePlanRequest(input: unknown): ParseRequestResult {
  const parsed = planRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, request: parsed.data };
  const fields = new Set<string>();
  for (const issue of parsed.error.issues) {
    if (issue.code === 'unrecognized_keys') fields.add('unknown_field');
    else fields.add(issue.path.length > 0 ? String(issue.path[0]) : 'body');
  }
  return { ok: false, fields: [...fields].sort() };
}
