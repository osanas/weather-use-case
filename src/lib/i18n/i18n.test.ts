import { describe, expect, it } from 'vitest';
import { cityDisplayName, getCityById } from '@/lib/cities';
import { searchCities } from '@/lib/city-search';
import { describeWeatherCode, formatDay, formatHour, formatPercent, formatTemperature, formatWind } from '@/lib/format';
import { longDayLabel, monthLabel } from '@/lib/planner/calendar';
import { chatView, NO_ANSWERS, type ChatState } from '@/lib/planner/conversation';
import { fieldMessage } from '@/lib/planner/form';
import { compactValue, threeHourMarks, weekdayOf } from '@/lib/weather-widget';
import { errorText } from './error-text';
import { getMessages } from './index';

/** Every leaf of a dictionary as "path:type", functions with their parameter count. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}:function/${value.length}`];
  if (typeof value !== 'object' || value === null) return [`${path}:${typeof value}`];
  return Object.entries(value).flatMap(([key, child]) => shape(child, `${path}.${key}`)).sort();
}

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value]
    : typeof value === 'object' && value !== null ? Object.values(value).flatMap(strings) : [];

/** Intl separates with no-break spaces, which vary between ICU versions. */
const spaces = (text: string) => text.replace(/\s/g, ' ');

describe('dictionaries', () => {
  it('have the same keys and value types in English and French', () => {
    expect(shape(getMessages('fr'))).toEqual(shape(getMessages('en')));
  });

  it('have no empty text', () => {
    for (const locale of ['en', 'fr'] as const) {
      expect(strings(getMessages(locale)).filter(s => !s.trim())).toEqual([]);
    }
  });
});

describe('fr-CA formatting', () => {
  const zone = 'America/Toronto';

  it('formats days, hours and months', () => {
    expect(spaces(formatDay('2027-06-19', 'fr'))).toBe('sam. 19 juin');
    expect(spaces(formatHour('2027-06-19T15:00:00Z', zone, 'fr'))).toBe('11 h 00 HAE');
    expect(spaces(longDayLabel('2027-06-19', 'fr'))).toBe('samedi 19 juin');
    expect(spaces(monthLabel('2027-06-19', 'fr'))).toBe('juin 2027');
    expect(weekdayOf('2027-06-19', 'long', 'fr')).toBe('samedi');
  });

  it('formats readings and chart labels', () => {
    expect(spaces(formatPercent(40, 'fr'))).toBe('40 %');
    expect(spaces(formatTemperature(-7.6, 'metric', 'fr'))).toBe('-8 °C');
    expect(formatWind(14.6, 'metric', 'fr')).toBe('15 km/h');
    expect(formatWind(null, 'metric', 'fr')).toBe('Non disponible');
    expect(describeWeatherCode(3, 'fr')).toBe('Couvert');
    expect(spaces(compactValue(40, 'precipitation', 'metric', 'fr'))).toBe('40 %');
    const hour = { time: '2027-06-19T13:00:00Z', temperatureC: 1, precipitationProbability: 1, windKmh: 1, weatherCode: 1 };
    expect(threeHourMarks([hour], zone, 'fr')[0]?.label).toBe('09 h');
  });
});

describe('French conversation and messages', () => {
  const state: ChatState = {
    answers: NO_ANSWERS, locale: 'fr', cityName: 'Laval, Québec', cityChoices: [],
    bounds: { min: '2027-06-14', max: '2027-06-20' }, days: null, errors: {}, request: null,
  };

  it('asks and offers answers in French', () => {
    const view = chatView(state);
    expect(view.prompt).toBe('Quand voulez-vous sortir?');
    expect(view.choices.map(c => c.label)).toContain('Cette fin de semaine');
  });

  it('rebuilds a stored English field error in French', () => {
    const answers = { ...NO_ANSWERS, activity: 'hiking', city: true, when: 'today' as const, date: '2027-06-14', duration: '2' };
    const view = chatView({ ...state, answers, errors: { activity: fieldMessage('activity') } });
    expect(view.prompt).toContain('Choisissez une activité.');
    expect(view.prompt).not.toContain('Choose');
  });

  it('maps server error codes, with a generic message for unknown ones', () => {
    const t = getMessages('fr');
    expect(errorText(t, 'invalid_city', 'weather')).toBe(t.errors.unknownCity);
    expect(errorText(t, 'payload_too_large', 'plan')).toBe(t.errors.tooLarge);
    expect(errorText(t, 'something_new', 'plan')).toBe(t.errors.planning);
    expect(errorText(t, undefined, 'weather')).toBe(t.errors.weather);
  });
});

describe('city names', () => {
  it('translates Québec City and province names', () => {
    expect(cityDisplayName(getCityById('quebec-qc')!, 'fr')).toBe('Québec, Québec');
    expect(cityDisplayName(getCityById('vancouver-bc')!, 'fr')).toBe('Vancouver, Colombie-Britannique');
  });

  it('searches province names in either language', () => {
    const cities = [getCityById('vancouver-bc')!, getCityById('halifax-ns')!];
    for (const query of ['Vancouver, Colombie', 'Vancouver, British']) {
      expect(searchCities(query, cities).map(c => c.id)).toEqual(['vancouver-bc']);
    }
  });
});
