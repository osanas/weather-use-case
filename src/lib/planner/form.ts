import { localDateString } from '@/lib/forecast';
import { FORECAST_DAYS } from '@/lib/weather/open-meteo';
import { parsePlanRequest, type PlanRequest } from './criteria';
import { addCalendarDays } from './planner';

export const FORM_FIELDS = ['activity', 'date', 'durationHours'] as const;
export type FormField = (typeof FORM_FIELDS)[number];

/** Raw input values as typed in the form. */
export type PlanFormValues = Record<FormField, string>;
/** Field errors, plus `cityId` and a general `form` error. */
export type PlanFormErrors = Partial<Record<FormField | 'cityId' | 'form', string>>;

export const EMPTY_FORM: PlanFormValues = {
  activity: '', date: '', durationHours: '',
};

export type DateBounds = { min: string; max: string };

/** Selectable dates: today in the city's zone through the last day of the forecast horizon. */
export function planDateBounds(now: number, timeZone: string): DateBounds {
  const min = localDateString(now, timeZone);
  return { min, max: addCalendarDays(min, FORECAST_DAYS - 1) };
}

export function fieldMessage(field: string, bounds?: DateBounds): string {
  switch (field) {
    case 'cityId': return 'Choose a city from the list.';
    case 'activity': return 'Choose an activity.';
    case 'date': return bounds
      ? `Choose a date from ${bounds.min} to ${bounds.max}.`
      : 'Choose a date within the forecast period.';
    case 'durationHours': return 'Enter a whole number of hours from 1 to 4.';
    default: return 'Check the planning criteria and try again.';
  }
}

const toNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
};

export type FormValidation =
  | { ok: true; request: PlanRequest }
  | { ok: false; errors: PlanFormErrors };

/**
 * Validates the form with the same schema the server uses, plus the date bounds, so the
 * browser only sends structured, valid user-selected fields. Thresholds are never part of
 * the form; the server resolves them. The server still validates everything.
 */
export function validatePlanForm(values: PlanFormValues, cityId: string, bounds: DateBounds, days = 1): FormValidation {
  const errors: PlanFormErrors = {};
  const parsed = parsePlanRequest({
    cityId,
    activity: values.activity === '' ? undefined : values.activity,
    date: values.date === '' ? undefined : values.date,
    durationHours: toNumber(values.durationHours),
    // Only "I'm flexible" searches several days; a one-day request keeps the original body.
    ...(days > 1 ? { days } : {}),
  });
  if (!parsed.ok) {
    // `days` belongs to the day answer ("I'm flexible"), so its error returns to that question.
    for (const field of parsed.fields) {
      const key = field === 'days' ? 'date' : field;
      errors[key as FormField | 'cityId'] = fieldMessage(key, bounds);
    }
  }
  if (!errors.date && (values.date < bounds.min || addCalendarDays(values.date, days - 1) > bounds.max)) {
    errors.date = fieldMessage('date', bounds);
  }
  if (parsed.ok && Object.keys(errors).length === 0) return { ok: true, request: parsed.request };
  return { ok: false, errors };
}
