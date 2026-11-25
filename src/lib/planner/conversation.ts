import { describeWeatherCode, formatDay, formatPercent, formatTemperature } from '@/lib/format';
import { messages as t } from '@/lib/i18n/messages';
import type { DailySummary } from '@/lib/weather/types';
import { datesIn, inBounds, nextWeekDates, weekendDates } from './calendar';
import type { PlanRequest } from './criteria';
import { FORM_FIELDS, type DateBounds, type FormField, type PlanFormErrors, type PlanFormValues } from './form';
import { addCalendarDays } from './planner';
import { ACTIVITIES, type PlanResponse } from './types';

/**
 * Pico's planning conversation as a pure function of the answers given so far. The chat
 * only collects the same three fields as AG-01 (activity, date, duration) plus a confirmed
 * city; the server still validates and plans. Pico's lines never contain times or weather
 * figures. Day choices may show the public daily forecast for that day, never a score.
 */

export type GuideMood = 'hello' | 'thinking' | 'happy' | 'unsure';

export type When = 'today' | 'tomorrow' | 'after' | 'weekend' | 'next-week' | 'flexible' | 'pick';
const MULTI_DAY: readonly When[] = ['weekend', 'next-week', 'flexible'];
export const isMultiDay = (when: When | null) => when !== null && MULTI_DAY.includes(when);

export type Answers = {
  /** A planning profile from `ACTIVITIES`; `other` when the visitor typed their own. */
  activity: string;
  /** The typed activity name, shown in the browser only and never sent. */
  label: string;
  /** The visitor confirmed the city the plan is for. */
  city: boolean;
  when: When | null;
  date: string;
  duration: string;
};

export const NO_ANSWERS: Answers = { activity: '', label: '', city: false, when: null, date: '', duration: '' };

export type ChatRequest =
  | { status: 'loading'; request: PlanRequest }
  | { status: 'done'; request: PlanRequest; data: PlanResponse }
  | { status: 'error'; request: PlanRequest; message: string };

export type ChatStep =
  | 'activity' | 'city' | 'when' | 'day' | 'duration'
  | 'ready' | 'checking' | 'result' | 'error' | 'fix';

/** Which answered question a turn belongs to; `Edit` clears that answer. */
export type TurnKey = 'activity' | 'city' | 'when' | 'day' | 'duration';

export type Choice = {
  id: string;
  label: string;
  /** Public forecast summary shown with a day choice. */
  detail?: string;
  /** Answers this choice sets; merged into the current answers. */
  answer?: Partial<Answers>;
  /** Selects this catalogue city as well. */
  cityId?: string;
  /** Opens the matching structured input instead of answering. */
  opens?: 'city' | 'date';
  /** Sends the plan request with the current answers. */
  submit?: boolean;
};

export type Turn = { key: TurnKey; question: string; answer: string };

export type ChatView = {
  turns: Turn[];
  step: ChatStep;
  prompt: string;
  mood: GuideMood;
  /** Announce the prompt politely: only for new questions, never for errors or results. */
  announce: boolean;
  choices: Choice[];
  /** The structured input offered as an alternative to the choices. */
  input: 'activity' | 'date' | 'duration' | null;
};

export type ChatState = {
  answers: Answers;
  cityName: string;
  /** Catalogue cities offered as quick choices, the selected one first. */
  cityChoices: readonly { id: string; label: string }[];
  bounds: DateBounds | null;
  /** Daily forecast for the selected city, or `null` when it is missing or expired. */
  days: readonly DailySummary[] | null;
  errors: PlanFormErrors;
  request: ChatRequest | null;
};

export const activityLabel = (activity: string) => t.activity[activity] ?? activity;

/** The activity as the visitor knows it: their typed name for `other`, else the profile's. */
export const activityName = (answers: Pick<Answers, 'activity' | 'label'>) =>
  answers.activity === 'other' && answers.label ? answers.label : activityLabel(answers.activity);

/** Profiles offered as badges; `other` is reached by typing a name. */
export const ACTIVITY_CHOICES = ACTIVITIES.filter(a => a !== 'other');

export function relativeDay(date: string, bounds: DateBounds | null): string {
  if (bounds && date === bounds.min) return 'Today';
  if (bounds && date === addCalendarDays(bounds.min, 1)) return 'Tomorrow';
  return formatDay(date);
}

/** The single date for a one-day choice, or `null` outside the horizon. */
export function dateForWhen(when: When, bounds: DateBounds): string | null {
  const offset = { today: 0, tomorrow: 1, after: 2 }[when as 'today' | 'tomorrow' | 'after'];
  if (offset === undefined) return null;
  const date = addCalendarDays(bounds.min, offset);
  return inBounds(date, bounds) ? date : null;
}

/**
 * Dates offered for a multi-day choice. Next week falls past the seven-day horizon on some
 * days, so Pico then offers the last days it can see.
 */
export function datesForWhen(when: When, bounds: DateBounds): string[] {
  if (when === 'weekend') return weekendDates(bounds);
  if (when === 'flexible') return datesIn(bounds);
  if (when === 'next-week') {
    const dates = nextWeekDates(bounds);
    return dates.length > 0 ? dates : datesIn(bounds).slice(-3);
  }
  return [];
}

export function answersToValues(answers: Answers): PlanFormValues {
  return { activity: answers.activity, date: answers.date, durationHours: answers.duration };
}

/** All three planning fields and the city are answered. */
export const isComplete = (a: Answers) => a.activity !== '' && a.city && a.date !== '' && a.duration.trim() !== '';

/** Answers left after the visitor edits one of them. */
export function clearAnswer(answers: Answers, key: TurnKey): Answers {
  switch (key) {
    case 'activity': return { ...answers, activity: '', label: '' };
    case 'city': return { ...answers, city: false };
    case 'when': return { ...answers, when: null, date: '' };
    case 'day': return { ...answers, date: '' };
    case 'duration': return { ...answers, duration: '' };
  }
}

/** Whether a sent request was made with exactly these answers. */
export function matchesAnswers(request: PlanRequest, answers: Answers): boolean {
  return request.activity === answers.activity
    && request.date === answers.date
    && String(request.durationHours) === answers.duration.trim();
}

function dayDetail(date: string, days: readonly DailySummary[] | null): string | undefined {
  const day = days?.find(d => d.date === date);
  if (!day) return undefined;
  return [describeWeatherCode(day.weatherCode), formatTemperature(day.maxC), `${formatPercent(day.precipitationProbability)} rain`]
    .join(' · ');
}

function dayQuestion(when: When | null, bounds: DateBounds | null): string {
  if (when === 'weekend') return t.ask.dayWeekend;
  if (when === 'next-week') return t.ask.dayNextWeek(bounds ? formatDay(bounds.max) : 'the end of the week');
  return t.ask.dayFlexible;
}

function whenAnswer(answers: Answers, bounds: DateBounds | null): string {
  if (answers.when === 'pick' || answers.when === null) return relativeDay(answers.date, bounds);
  return t.when[answers.when];
}

function turnsFor(state: ChatState): Turn[] {
  const { answers, bounds, cityName } = state;
  const turns: Turn[] = [];
  if (!answers.when && !answers.date) return turns;
  turns.push({ key: 'when', question: t.ask.when, answer: whenAnswer(answers, bounds) });
  if (isMultiDay(answers.when)) {
    if (!answers.date) return turns;
    turns.push({ key: 'day', question: dayQuestion(answers.when, bounds), answer: relativeDay(answers.date, bounds) });
  }
  if (!answers.activity) return turns;
  turns.push({ key: 'activity', question: t.ask.activity, answer: activityName(answers) });
  if (!answers.city) return turns;
  turns.push({ key: 'city', question: t.ask.city(activityName(answers)), answer: cityName });
  if (!answers.duration.trim()) return turns;
  const hours = Number(answers.duration);
  turns.push({
    key: 'duration', question: t.ask.duration,
    answer: Number.isInteger(hours) ? t.duration(hours) : answers.duration,
  });
  return turns;
}

const ask = (step: ChatStep, prompt: string, choices: Choice[], input: ChatView['input'] = null) =>
  ({ step, prompt, mood: 'hello' as GuideMood, announce: true, choices, input });

/** Trims turns that come after the question being asked or fixed. */
function turnsBefore(turns: Turn[], key: TurnKey): Turn[] {
  const order: TurnKey[] = ['when', 'day', 'activity', 'city', 'duration'];
  return turns.filter(turn => order.indexOf(turn.key) < order.indexOf(key));
}

const WHEN_ORDER: readonly When[] = ['today', 'tomorrow', 'after', 'weekend', 'next-week', 'flexible'];

function whenChoices(bounds: DateBounds | null): Choice[] {
  if (!bounds) return [];
  return WHEN_ORDER.flatMap<Choice>(when => {
    if (isMultiDay(when)) {
      return datesForWhen(when, bounds).length > 0 ? [{ id: `when-${when}`, label: t.when[when], answer: { when, date: '' } }] : [];
    }
    const date = dateForWhen(when, bounds);
    return date ? [{ id: `when-${when}`, label: t.when[when], answer: { when, date } }] : [];
  });
}

const NEXT_CHOICES: Choice[] = [
  { id: 'next-another', label: t.next.another, answer: { activity: '', label: '', when: null, date: '', duration: '' } },
  { id: 'next-day', label: t.next.otherDay, answer: { when: null, date: '' } },
  { id: 'next-duration', label: t.next.duration, answer: { duration: '' } },
];

function resultView(request: ChatRequest): Omit<ChatView, 'turns'> {
  const view = (step: ChatStep, prompt: string, mood: GuideMood, choices: Choice[] = NEXT_CHOICES) =>
    ({ step, prompt, mood, announce: false, choices, input: null });
  if (request.status === 'loading') return view('checking', t.ask.checking, 'thinking', []);
  if (request.status === 'error') return view('error', t.ask.error, 'unsure', []);
  switch (request.data.outcome) {
    case 'match': return view('result', t.ask.match, 'happy');
    case 'no_match': return view('result', t.ask.noMatch, 'unsure');
    case 'insufficient': return view('result', t.ask.insufficient, 'unsure');
    case 'planning_unavailable': return view('result', t.ask.unavailable, 'unsure');
  }
}

/** The conversation for the current answers and request. Pure, so it can be tested directly. */
export function chatView(state: ChatState): ChatView {
  const { answers, bounds, errors, request } = state;
  const turns = turnsFor(state);

  const fieldError = FORM_FIELDS.find(field => errors[field]);
  if (fieldError) {
    const key: TurnKey = fieldError === 'activity' ? 'activity' : fieldError === 'date' ? 'when' : 'duration';
    const base = chatView({ ...state, errors: {}, request: null, answers: clearAnswer(answers, key) });
    return {
      ...base,
      turns: turnsBefore(turns, key),
      step: 'fix',
      mood: 'unsure',
      announce: false,
      prompt: t.ask.fix(t.fields[fieldError as FormField], errors[fieldError] ?? ''),
    };
  }
  if (errors.cityId || errors.form) {
    return { turns, step: 'fix', prompt: `${t.ask.fixForm} ${errors.cityId ?? errors.form}`, mood: 'unsure', announce: false, choices: NEXT_CHOICES, input: null };
  }
  if (request?.status === 'loading') return { turns, ...resultView(request) };

  if (!answers.date && !isMultiDay(answers.when)) {
    return { turns, ...ask('when', t.ask.when, whenChoices(bounds), 'date') };
  }
  if (!answers.date) {
    const dates = bounds && answers.when ? datesForWhen(answers.when, bounds) : [];
    return {
      turns,
      ...ask('day', dayQuestion(answers.when, bounds), dates.map(date => ({
        id: `day-${date}`, label: relativeDay(date, bounds), detail: dayDetail(date, state.days), answer: { date },
      })), 'date'),
    };
  }
  if (!ACTIVITIES.includes(answers.activity as (typeof ACTIVITIES)[number])) {
    return {
      turns,
      ...ask('activity', t.ask.activity,
        ACTIVITY_CHOICES.map(a => ({ id: `activity-${a}`, label: activityLabel(a), answer: { activity: a, label: '' } })), 'activity'),
    };
  }
  if (!answers.city) {
    return {
      turns,
      ...ask('city', t.ask.city(activityName(answers)), [
        ...state.cityChoices.map(c => ({ id: `city-${c.id}`, label: c.label, cityId: c.id, answer: { city: true } })),
        { id: 'city-other', label: t.city.other, opens: 'city' as const },
      ]),
    };
  }
  if (!answers.duration.trim()) {
    return {
      turns,
      ...ask('duration', t.ask.duration,
        [1, 2, 3, 4].map(h => ({ id: `duration-${h}`, label: t.duration(h), answer: { duration: String(h) } })), 'duration'),
    };
  }
  if (request && matchesAnswers(request.request, answers)) return { turns, ...resultView(request) };
  return {
    turns,
    step: 'ready', prompt: t.ask.ready(state.cityName), mood: 'happy', announce: true, input: null,
    choices: [{ id: 'find', label: t.next.find, submit: true }],
  };
}
