import { describe, expect, it } from 'vitest';
import {
  activityName, answersToValues, chatView, clearAnswer, datesForWhen, daysForWhen, isComplete, matchesAnswers, NO_ANSWERS, resultDate, withFlexibleToday,
  type Answers, type ChatRequest, type ChatState,
} from './conversation';
import type { PlanRequest } from './criteria';
import type { PlanCriteria, PlanResponse } from './types';

// Synthetic state only. 2027-06-14 is a Monday; the horizon runs to Sunday 2027-06-20.
const bounds = { min: '2027-06-14', max: '2027-06-20' };
const request: PlanRequest = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2 };
const criteria: PlanCriteria = { ...request, days: 1, maxPrecipitationProbability: 35, maxWindKmh: 28 };
const full: Answers = { activity: 'hiking', label: '', city: true, when: 'weekend', date: '2027-06-19', duration: '2' };

const state = (answers: Partial<Answers> = {}, overrides: Partial<ChatState> = {}): ChatState => ({
  answers: { ...NO_ANSWERS, ...answers },
  cityName: 'Laval, Québec',
  cityChoices: [{ id: 'laval-qc', label: 'Laval' }, { id: 'montreal-qc', label: 'Montréal' }],
  bounds,
  days: [{ date: '2027-06-19', weatherCode: 0, minC: 12, maxC: 22, precipitationProbability: 10 }],
  errors: {},
  request: null,
  ...overrides,
});
const done = (data: PlanResponse): ChatRequest => ({ status: 'done', request, data });
const TIME_OR_FIGURE = /\d+\s*%|km\/h|\d{1,2}:\d{2}|°/;

describe('chatView', () => {
  it('asks when first, then the activity, the city and the duration, recording each answer as a turn', () => {
    const when = chatView(state());
    expect(when).toMatchObject({ step: 'when', mood: 'hello', announce: true, input: 'date', turns: [] });
    expect(when.prompt).toBe('When do you want to go outside?');
    expect(when.choices.map(c => c.label)).toEqual(['Today', 'Tomorrow', 'Day after tomorrow', 'This weekend', 'Next week', 'I’m flexible']);
    expect(when.choices[1]!.answer).toEqual({ when: 'tomorrow', date: '2027-06-15' });

    const day = chatView(state({ when: 'weekend' }));
    expect(day.step).toBe('day');
    expect(day.choices.map(c => [c.label, c.detail])).toEqual([
      ['Sat, Jun 19', 'Clear sky · 22 °C · 10% rain'], ['Sun, Jun 20', undefined],
    ]);

    const activity = chatView(state({ when: 'weekend', date: '2027-06-19' }));
    expect(activity).toMatchObject({ step: 'activity', input: 'activity' });
    expect(activity.choices.map(c => c.label)).toEqual(['Walking', 'Errands', 'Hiking', 'Cycling']);
    expect(activity.turns.map(t => [t.key, t.answer])).toEqual([['when', 'This weekend'], ['day', 'Sat, Jun 19']]);

    const city = chatView(state({ when: 'weekend', date: '2027-06-19', activity: 'hiking' }));
    expect(city.step).toBe('city');
    expect(city.prompt).toBe('Hiking it is! Where are you heading?');
    expect(city.choices.map(c => c.label)).toEqual(['Laval', 'Montréal', 'Other city']);
    expect(city.choices.at(-1)).toMatchObject({ opens: 'city' });
    expect(city.turns.at(-1)).toEqual({ key: 'activity', question: 'What would you like to do?', answer: 'Hiking' });

    const duration = chatView(state({ activity: 'hiking', city: true, when: 'weekend', date: '2027-06-19' }));
    expect(duration.step).toBe('duration');
    expect(duration.choices.map(c => c.label)).toEqual(['1 hour', '2 hours', '3 hours', '4 hours']);
    expect(duration.turns.map(t => [t.key, t.answer])).toEqual([
      ['when', 'This weekend'], ['day', 'Sat, Jun 19'], ['activity', 'Hiking'], ['city', 'Laval, Québec'],
    ]);
  });

  it('skips the day question for one-day choices and shows picked dates as days', () => {
    expect(chatView(state({ when: 'pick', date: '2027-06-17' })).step).toBe('activity');
    const view = chatView(state({ activity: 'walking', city: true, when: 'pick', date: '2027-06-17' }));
    expect(view.step).toBe('duration');
    expect(view.turns.find(t => t.key === 'when')).toMatchObject({ answer: 'Thu, Jun 17' });
    expect(view.turns.some(t => t.key === 'day')).toBe(false);
    expect(chatView(state({ when: 'today', date: '2027-06-14' })).turns[0]!.answer).toBe('Today');
  });

  it('hides the later answers while an earlier one is edited, and keeps them', () => {
    const editing = chatView(state(clearAnswer(full, 'when')));
    expect(editing).toMatchObject({ step: 'when', turns: [] });
    expect(clearAnswer(full, 'when')).toMatchObject({ activity: 'hiking', city: true, duration: '2' });
  });

  it('offers no dates before the client clock is known', () => {
    expect(chatView(state({}, { bounds: null })).choices).toEqual([]);
  });

  it('offers to check again once everything is answered but nothing was sent for this city', () => {
    const view = chatView(state(full));
    expect(view).toMatchObject({ step: 'ready', mood: 'happy' });
    expect(view.choices).toEqual([{ id: 'find', label: 'Find best time', submit: true }]);
    expect(view.turns).toHaveLength(5);
  });

  it('reacts to loading, errors and results without announcing them', () => {
    const cases: [ChatRequest, string, string][] = [
      [{ status: 'loading', request }, 'checking', 'thinking'],
      [{ status: 'error', request, message: 'x' }, 'error', 'unsure'],
      [done({ outcome: 'match', mode: 'rule-based', start: '2027-06-19T14:00:00Z', end: '2027-06-19T16:00:00Z', maxPrecipitationProbability: 5, maxWindKmh: 8, criteria }), 'result', 'happy'],
      [done({ outcome: 'no_match', mode: 'rule-based', criteria }), 'result', 'unsure'],
      [done({ outcome: 'insufficient', reason: 'stale', mode: 'agent', criteria }), 'result', 'unsure'],
      [done({ outcome: 'planning_unavailable', reason: 'thresholds_not_defined' }), 'result', 'unsure'],
    ];
    for (const [req, step, mood] of cases) {
      const view = chatView(state(full, { request: req }));
      expect(view).toMatchObject({ step, mood, announce: false });
      expect(view.prompt).not.toMatch(TIME_OR_FIGURE);
    }
    const result = chatView(state(full, { request: cases[2]![0] }));
    expect(result.choices.map(c => c.label)).toEqual(['Plan another activity', 'Try another day', 'Change duration']);
  });

  it('goes back to the field the server or validation rejected, quietly', () => {
    const view = chatView(state(full, { errors: { date: 'Choose a date from Mon, Jun 14 to Sun, Jun 20.' } }));
    expect(view).toMatchObject({ step: 'fix', mood: 'unsure', announce: false, input: 'date' });
    expect(view.prompt).toBe('One thing to fix first: the date. Choose a date from Mon, Jun 14 to Sun, Jun 20.');
    // The date is asked first, so no earlier turn is kept.
    expect(view.turns).toEqual([]);
    expect(view.choices[0]!.label).toBe('Today');
    const activity = chatView(state(full, { errors: { activity: 'Choose an activity.' } }));
    expect(activity).toMatchObject({ step: 'fix', input: 'activity' });
    expect(activity.turns.map(t => t.key)).toEqual(['when', 'day']);
    expect(chatView(state(full, { errors: { form: 'Bad request.' } })).step).toBe('fix');
  });

  it('never puts a time or a weather figure in a question', () => {
    const steps = [
      state(), state({ when: 'next-week' }), state({ when: 'weekend', date: '2027-06-19' }),
      state({ when: 'weekend', date: '2027-06-19', activity: 'hiking' }),
      state({ activity: 'hiking', city: true, when: 'weekend', date: '2027-06-19' }), state(full),
    ];
    for (const s of steps) {
      const view = chatView(s);
      expect(view.prompt).not.toMatch(TIME_OR_FIGURE);
      for (const turn of view.turns) expect(turn.question).not.toMatch(TIME_OR_FIGURE);
    }
  });
});

describe('I’m flexible', () => {
  const flexible: Partial<Answers> = { when: 'flexible', date: '2027-06-14' };
  const flexRequest: PlanRequest = { ...request, date: '2027-06-14', days: 3 };

  it('sets today and asks no day: the next question is the activity', () => {
    const when = chatView(state());
    expect(when.choices.find(c => c.label === 'I’m flexible')!.answer).toEqual({ when: 'flexible', date: '2027-06-14' });
    const next = chatView(state(flexible));
    expect(next.step).toBe('activity');
    expect(next.turns.map(t => [t.key, t.answer])).toEqual([['when', 'I’m flexible']]);
  });

  it('renews a flexible date to the target city’s today, and leaves other choices alone', () => {
    const answers = { ...full, ...flexible };
    // Picked in Vancouver on the 14th, sent for Laval where it is already the 15th.
    expect(withFlexibleToday(answers, '2027-06-15').date).toBe('2027-06-15');
    expect(withFlexibleToday(answers, '2027-06-14')).toBe(answers);
    expect(withFlexibleToday({ ...answers, when: 'today' }, '2027-06-15').date).toBe('2027-06-14');
  });

  it('searches three days, and only flexible does', () => {
    expect(daysForWhen('flexible')).toBe(3);
    for (const when of ['today', 'tomorrow', 'after', 'weekend', 'next-week', 'pick', null] as const) expect(daysForWhen(when)).toBe(1);
  });

  it('matches a request only when its searched days agree with the choice', () => {
    const answers = { ...full, ...flexible };
    expect(matchesAnswers(flexRequest, answers)).toBe(true);
    expect(matchesAnswers({ ...flexRequest, days: undefined }, answers)).toBe(false);
    expect(matchesAnswers(flexRequest, { ...answers, when: 'today' })).toBe(false);
  });

  it('says it looks over three days, without times or figures', () => {
    const answers = { ...full, ...flexible };
    const ready = chatView(state(answers));
    expect(ready.prompt).toBe('Ready when you are. Shall I look over the next three days in Laval, Québec?');
    const flexCriteria = { ...criteria, date: '2027-06-14', days: 3 };
    const noMatch = chatView(state(answers, { request: { status: 'done', request: flexRequest, data: { outcome: 'no_match', mode: 'rule-based', criteria: flexCriteria } } }));
    expect(noMatch.prompt).toBe('No time in the next three days stays within the limits. Try a shorter duration or another day.');
    for (const view of [ready, noMatch]) expect(view.prompt).not.toMatch(TIME_OR_FIGURE);
  });

  it('dates a match by its window in the city zone, else by the first day requested', () => {
    const flexCriteria = { ...criteria, date: '2027-06-14', days: 3 };
    // 02:00Z on the 16th is still the 15th in Laval (EDT).
    const match = {
      outcome: 'match' as const, mode: 'rule-based' as const, criteria: flexCriteria,
      start: '2027-06-16T02:00:00Z', end: '2027-06-16T03:00:00Z', maxPrecipitationProbability: 0, maxWindKmh: 0,
    };
    expect(resultDate(match, 'America/Toronto')).toBe('2027-06-15');
    expect(resultDate({ outcome: 'no_match', criteria: flexCriteria }, 'America/Toronto')).toBe('2027-06-14');
  });
});

describe('multi-day choices', () => {
  it('finds the coming weekend and next week inside the horizon', () => {
    expect(datesForWhen('weekend', bounds)).toEqual(['2027-06-19', '2027-06-20']);
    // From a Wednesday, next week starts on Monday the 21st, past the horizon end.
    const wednesday = { min: '2027-06-16', max: '2027-06-22' };
    expect(datesForWhen('next-week', wednesday)).toEqual(['2027-06-21', '2027-06-22']);
  });

  it('offers the last visible days when next week is out of reach', () => {
    expect(datesForWhen('next-week', bounds)).toEqual(['2027-06-18', '2027-06-19', '2027-06-20']);
    const view = chatView(state({ when: 'next-week' }));
    expect(view.prompt).toBe('I can see the forecast up to Sun, Jun 20. Which day suits you?');
  });

  it('offers only Sunday when today is Sunday', () => {
    expect(datesForWhen('weekend', { min: '2027-06-20', max: '2027-06-26' })).toEqual(['2027-06-20']);
  });
});

describe('answers', () => {
  it('clears one answer for an edit and keeps the others', () => {
    expect(clearAnswer(full, 'when')).toEqual({ ...full, when: null, date: '' });
    expect(clearAnswer(full, 'day')).toEqual({ ...full, date: '' });
    expect(clearAnswer(full, 'city')).toEqual({ ...full, city: false });
    expect(isComplete(full)).toBe(true);
    expect(isComplete({ ...full, duration: ' ' })).toBe(false);
  });
});

describe('typed activity', () => {
  const typed: Partial<Answers> = { when: 'weekend', date: '2027-06-19', activity: 'other', label: 'Walk the dog' };

  it('shows the typed name in the conversation but sends only the other profile', () => {
    const city = chatView(state(typed));
    expect(city.prompt).toBe('Walk the dog it is! Where are you heading?');
    expect(city.turns.at(-1)).toMatchObject({ key: 'activity', answer: 'Walk the dog' });
    expect(answersToValues({ ...NO_ANSWERS, ...typed, city: true, duration: '2' }))
      .toEqual({ activity: 'other', date: '2027-06-19', durationHours: '2' });
  });

  it('never offers other as a badge and clears the name with the activity', () => {
    const activity = chatView(state({ when: 'weekend', date: '2027-06-19' }));
    expect(activity.choices.map(c => c.id)).not.toContain('activity-other');
    expect(clearAnswer({ ...NO_ANSWERS, ...typed }, 'activity')).toMatchObject({ activity: '', label: '' });
    expect(activityName({ activity: 'other', label: '' })).toBe('Other activity');
    expect(activityName({ activity: 'errands', label: 'ignored' })).toBe('Errands');
  });
});
