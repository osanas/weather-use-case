import { describe, expect, it } from 'vitest';
import {
  chatView, clearAnswer, datesForWhen, isComplete, NO_ANSWERS,
  type Answers, type ChatRequest, type ChatState,
} from './conversation';
import type { PlanRequest } from './criteria';
import type { PlanCriteria, PlanResponse } from './types';

// Synthetic state only. 2027-06-14 is a Monday; the horizon runs to Sunday 2027-06-20.
const bounds = { min: '2027-06-14', max: '2027-06-20' };
const request: PlanRequest = { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-19', durationHours: 2 };
const criteria: PlanCriteria = { ...request, maxPrecipitationProbability: 35, maxWindKmh: 28 };
const full: Answers = { activity: 'hiking', city: true, when: 'weekend', date: '2027-06-19', duration: '2' };

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
  it('asks the questions in order and records each answer as a turn', () => {
    expect(chatView(state())).toMatchObject({ step: 'activity', mood: 'hello', announce: true, input: 'activity', turns: [] });
    expect(chatView(state()).choices.map(c => c.label)).toEqual(['Hiking', 'Cycling', 'Walking']);

    const city = chatView(state({ activity: 'hiking' }));
    expect(city.step).toBe('city');
    expect(city.prompt).toBe('Hiking it is! Where are you heading?');
    expect(city.choices.map(c => c.label)).toEqual(['Laval', 'Montréal', 'Other city']);
    expect(city.choices.at(-1)).toMatchObject({ opens: 'city' });
    expect(city.turns).toEqual([{ key: 'activity', question: 'Hi, I’m Pico! What would you like to do?', answer: 'Hiking' }]);

    const when = chatView(state({ activity: 'hiking', city: true }));
    expect(when).toMatchObject({ step: 'when', input: 'date' });
    expect(when.choices.map(c => c.label)).toEqual(['Today', 'Tomorrow', 'Day after tomorrow', 'This weekend', 'Next week', 'I’m flexible']);
    expect(when.choices[1]!.answer).toEqual({ when: 'tomorrow', date: '2027-06-15' });

    const day = chatView(state({ activity: 'hiking', city: true, when: 'weekend' }));
    expect(day.step).toBe('day');
    expect(day.choices.map(c => [c.label, c.detail])).toEqual([
      ['Sat, Jun 19', 'Clear sky · 22 °C · 10% rain'], ['Sun, Jun 20', undefined],
    ]);

    const duration = chatView(state({ activity: 'hiking', city: true, when: 'weekend', date: '2027-06-19' }));
    expect(duration.step).toBe('duration');
    expect(duration.choices.map(c => c.label)).toEqual(['1 hour', '2 hours', '3 hours', '4 hours']);
    expect(duration.turns.map(t => [t.key, t.answer])).toEqual([
      ['activity', 'Hiking'], ['city', 'Laval, Québec'], ['when', 'This weekend'], ['day', 'Sat, Jun 19'],
    ]);
  });

  it('skips the day question for one-day choices and shows picked dates as days', () => {
    const view = chatView(state({ activity: 'walking', city: true, when: 'pick', date: '2027-06-17' }));
    expect(view.step).toBe('duration');
    expect(view.turns.at(-1)).toMatchObject({ key: 'when', answer: 'Thu, Jun 17' });
    expect(chatView(state({ activity: 'walking', city: true, when: 'today', date: '2027-06-14' })).turns.at(-1)!.answer).toBe('Today');
  });

  it('offers no dates before the client clock is known', () => {
    expect(chatView(state({ activity: 'hiking', city: true }, { bounds: null })).choices).toEqual([]);
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
    expect(view.turns.map(t => t.key)).toEqual(['activity', 'city']);
    expect(view.choices[0]!.label).toBe('Today');
    expect(chatView(state(full, { errors: { form: 'Bad request.' } })).step).toBe('fix');
  });

  it('never puts a time or a weather figure in a question', () => {
    const steps = [
      state(), state({ activity: 'hiking' }), state({ activity: 'hiking', city: true }),
      state({ activity: 'hiking', city: true, when: 'next-week' }),
      state({ activity: 'hiking', city: true, when: 'weekend', date: '2027-06-19' }), state(full),
    ];
    for (const s of steps) {
      const view = chatView(s);
      expect(view.prompt).not.toMatch(TIME_OR_FIGURE);
      for (const turn of view.turns) expect(turn.question).not.toMatch(TIME_OR_FIGURE);
    }
  });
});

describe('multi-day choices', () => {
  it('finds the coming weekend and next week inside the horizon', () => {
    expect(datesForWhen('weekend', bounds)).toEqual(['2027-06-19', '2027-06-20']);
    expect(datesForWhen('flexible', bounds)).toHaveLength(7);
    // From a Wednesday, next week starts on Monday the 21st, past the horizon end.
    const wednesday = { min: '2027-06-16', max: '2027-06-22' };
    expect(datesForWhen('next-week', wednesday)).toEqual(['2027-06-21', '2027-06-22']);
  });

  it('offers the last visible days when next week is out of reach', () => {
    expect(datesForWhen('next-week', bounds)).toEqual(['2027-06-18', '2027-06-19', '2027-06-20']);
    const view = chatView(state({ activity: 'hiking', city: true, when: 'next-week' }));
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
