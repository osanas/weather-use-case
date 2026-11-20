import { formatDay } from '@/lib/format';
import type { PlanRequest } from './criteria';
import { FORM_FIELDS, type DateBounds, type FormField, type PlanFormErrors, type PlanFormValues } from './form';
import type { PlanResponse } from './types';

/**
 * Predefined prompts for the planning guide. The guide only reads the form state: it never
 * fills, submits or validates anything, and it works without the AI feature. Prompts never
 * contain times or weather figures; those come from the planner result alone.
 */

export type GuideRequest =
  | { status: 'loading'; request: PlanRequest }
  | { status: 'done'; request: PlanRequest; data: PlanResponse }
  | { status: 'error'; request: PlanRequest; message: string };

export type GuideState = {
  cityName: string;
  values: PlanFormValues;
  errors: PlanFormErrors;
  bounds: DateBounds | null;
  /** The request for the current city, or `null`. */
  request: GuideRequest | null;
};

export type GuideStep =
  | 'activity' | 'date' | 'duration' | 'ready'
  | 'fix-activity' | 'fix-date' | 'fix-durationHours' | 'fix-form'
  | 'loading' | 'match' | 'no_match' | 'insufficient' | 'unavailable' | 'error';

export type GuideMood = 'hello' | 'thinking' | 'happy' | 'unsure';

export type GuidePrompt = {
  step: GuideStep;
  text: string;
  mood: GuideMood;
  /**
   * Whether a change to this prompt is announced to assistive technology. Field errors and
   * results already have their own announcements, so the guide stays quiet for those.
   */
  announce: boolean;
};

const ACTIVITY_NAMES: Record<string, string> = { hiking: 'Hiking', cycling: 'Cycling', walking: 'Walking' };

const FIELD_NAMES: Record<FormField, string> = {
  activity: 'the activity', date: 'the date', durationHours: 'the duration',
};

/** The submitted request still matches what is in the form. */
function matchesForm(request: PlanRequest, values: PlanFormValues): boolean {
  return request.activity === values.activity
    && request.date === values.date
    && String(request.durationHours) === values.durationHours.trim();
}

function resultPrompt(request: GuideRequest): GuidePrompt {
  if (request.status === 'loading') {
    return { step: 'loading', mood: 'thinking', announce: false, text: 'Checking the hourly forecast…' };
  }
  if (request.status === 'error') {
    return {
      step: 'error', mood: 'unsure', announce: false,
      text: 'I couldn’t get an answer this time. Use Retry below to ask again.',
    };
  }
  switch (request.data.outcome) {
    case 'match':
      return {
        step: 'match', mood: 'happy', announce: false,
        text: 'Good news! I found a time that fits. The details are below.',
      };
    case 'no_match':
      return {
        step: 'no_match', mood: 'unsure', announce: false,
        text: 'No time that day stays within the limits. Try another date or a shorter duration.',
      };
    case 'insufficient':
      return {
        step: 'insufficient', mood: 'unsure', announce: false,
        text: 'The forecast doesn’t have enough to go on. You can try again below.',
      };
    case 'planning_unavailable':
      return {
        step: 'unavailable', mood: 'unsure', announce: false,
        text: 'Planning is paused right now, but the forecast above is still there.',
      };
  }
}

/** Chooses the guide prompt for the current form state. Pure, so it can be tested directly. */
export function guidePrompt({ cityName, values, errors, bounds, request }: GuideState): GuidePrompt {
  const firstError = FORM_FIELDS.find(field => errors[field]);
  if (firstError) {
    return {
      step: `fix-${firstError}`, mood: 'unsure', announce: false,
      text: `One thing to fix first: ${FIELD_NAMES[firstError]}. The message under the field says how.`,
    };
  }
  if (errors.cityId || errors.form) {
    return {
      step: 'fix-form', mood: 'unsure', announce: false,
      text: 'Something needs another look. Check the message above the fields.',
    };
  }
  if (request?.status === 'loading') return resultPrompt(request);

  const activity = ACTIVITY_NAMES[values.activity];
  if (!activity) {
    return {
      step: 'activity', mood: 'hello', announce: true,
      text: `Hi, I’m Cirrus! What would you like to do in ${cityName}? Pick hiking, cycling or walking.`,
    };
  }
  if (values.date === '') {
    const until = bounds ? `up to ${formatDay(bounds.max)}` : 'in the coming week';
    return {
      step: 'date', mood: 'hello', announce: true,
      text: `${activity} it is! Which day? Pick a date ${until}.`,
    };
  }
  if (values.durationHours.trim() === '') {
    return {
      step: 'duration', mood: 'hello', announce: true,
      text: 'How long will you be out? Choose 1 to 4 hours.',
    };
  }
  if (request && matchesForm(request.request, values)) return resultPrompt(request);
  return {
    step: 'ready', mood: 'happy', announce: true,
    text: 'All set! Select Find best time and I’ll check the hourly forecast.',
  };
}
