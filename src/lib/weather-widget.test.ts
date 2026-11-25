import { describe, expect, it } from 'vitest';
import { localDateString } from './forecast';
import type { HourlyPoint } from './weather/types';
import {
  compactValue,
  hoursOn,
  localParts,
  limitFor,
  maxValue,
  metricDomain,
  metricValues,
  threeHourMarks,
  weekdayOf,
  windowSpans,
} from './weather-widget';

const HOUR = 3_600_000;
const TORONTO = 'America/Toronto';

/** Synthetic consecutive hours from a UTC instant. */
function hoursFrom(startIso: string, count: number): HourlyPoint[] {
  const start = Date.parse(startIso);
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(start + i * HOUR).toISOString(),
    temperatureC: i - 5,
    precipitationProbability: i * 10,
    windKmh: i,
    weatherCode: 3,
  }));
}

describe('metricValues', () => {
  it('reads the tab’s reading from each hour', () => {
    const hours = hoursFrom('2027-01-15T19:00:00Z', 2);
    expect(metricValues(hours, 'temperature')).toEqual([-5, -4]);
    expect(metricValues(hours, 'precipitation')).toEqual([0, 10]);
    expect(metricValues(hours, 'wind')).toEqual([0, 1]);
  });
});

describe('metricDomain', () => {
  it('uses the day’s own range for temperature', () => {
    expect(metricDomain([-8, null, 2], 'temperature')).toEqual({ min: -8, max: 2 });
    expect(metricDomain([null], 'temperature')).toBeNull();
  });

  it('always spans 0–100 % for precipitation', () => {
    expect(metricDomain([5, 20], 'precipitation')).toEqual({ min: 0, max: 100 });
  });

  it('scales wind to the highest of the readings, the limit and a calm minimum', () => {
    expect(metricDomain([3, 6], 'wind')).toEqual({ min: 0, max: 10 });
    expect(metricDomain([3, 32], 'wind')).toEqual({ min: 0, max: 32 });
    expect(metricDomain([3, 12], 'wind', 25)).toEqual({ min: 0, max: 25 });
    expect(metricDomain([null], 'wind')).toEqual({ min: 0, max: 10 });
  });
});

describe('limitFor', () => {
  const limits = { maxPrecipitationProbability: 20, maxWindKmh: 25 };

  it('draws limits on the precipitation and wind tabs only', () => {
    expect(limitFor('precipitation', limits)).toBe(20);
    expect(limitFor('wind', limits)).toBe(25);
    expect(limitFor('temperature', limits)).toBeNull();
  });

  it('draws nothing without limits or with a non-finite limit', () => {
    expect(limitFor('wind', undefined)).toBeNull();
    expect(limitFor('wind', { maxPrecipitationProbability: 20, maxWindKmh: Number.NaN })).toBeNull();
  });
});

describe('maxValue', () => {
  it('is the highest known value or null', () => {
    expect(maxValue([4, null, 18, 7])).toBe(18);
    expect(maxValue([null])).toBeNull();
  });
});

describe('threeHourMarks', () => {
  it('labels every third local hour in the city’s zone', () => {
    // 05:00Z is midnight EST in Toronto.
    const marks = threeHourMarks(hoursFrom('2027-01-15T05:00:00Z', 24), TORONTO);
    expect(marks.map(m => m.label)).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);
    expect(marks.map(m => m.index)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });

  it('keeps local hours on the 23-hour spring-forward day', () => {
    const day = hoursOn(hoursFrom('2027-03-14T00:00:00Z', 48), '2027-03-14', TORONTO);
    expect(day).toHaveLength(23);
    const marks = threeHourMarks(day, TORONTO);
    expect(marks.map(m => m.label)).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);
    // 02:00 does not exist, so 03:00 is the third point of the day.
    expect(marks[1]).toEqual({ index: 2, hour: 3, label: '03:00' });
  });

  it('keeps local hours on the 25-hour fall-back day', () => {
    const day = hoursOn(hoursFrom('2027-11-07T00:00:00Z', 48), '2027-11-07', TORONTO);
    expect(day).toHaveLength(25);
    const marks = threeHourMarks(day, TORONTO);
    expect(marks.map(m => m.label)).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);
    // 01:00 happens twice, so 03:00 is the fifth point of the day.
    expect(marks[1]).toEqual({ index: 4, hour: 3, label: '03:00' });
  });

  it('starts at the first labelled hour of a partial day', () => {
    // 19:00Z is 14:00 EST: the points are 14:00 to 18:00.
    expect(threeHourMarks(hoursFrom('2027-01-15T19:00:00Z', 5), TORONTO)).toEqual([
      { index: 1, hour: 15, label: '15:00' },
      { index: 4, hour: 18, label: '18:00' },
    ]);
  });
});

describe('windowSpans', () => {
  const hours = hoursFrom('2027-01-15T12:00:00Z', 6);

  it('covers hours starting inside the window, start inclusive and end exclusive', () => {
    expect(windowSpans(hours, [{ start: '2027-01-15T14:00:00Z', end: '2027-01-15T16:00:00Z', active: false }]))
      .toEqual([{ from: 2, to: 4, active: false }]);
  });

  it('clips windows to the day and ignores windows outside it', () => {
    expect(windowSpans(hours, [
      { start: '2027-01-15T16:00:00Z', end: '2027-01-15T20:00:00Z', active: false },
      { start: '2027-01-16T10:00:00Z', end: '2027-01-16T12:00:00Z', active: true },
    ])).toEqual([{ from: 4, to: 6, active: false }]);
  });

  it('draws the active window last so its outline is on top', () => {
    expect(windowSpans(hours, [
      { start: '2027-01-15T12:00:00Z', end: '2027-01-15T13:00:00Z', active: true },
      { start: '2027-01-15T15:00:00Z', end: '2027-01-15T17:00:00Z', active: false },
    ])).toEqual([{ from: 3, to: 5, active: false }, { from: 0, to: 1, active: true }]);
  });

  it('draws nothing for no windows or unparseable times', () => {
    expect(windowSpans(hours, [])).toEqual([]);
    expect(windowSpans(hours, [{ start: 'not a date', end: '2027-01-15T16:00:00Z', active: true }])).toEqual([]);
  });
});

describe('compactValue', () => {
  it('prints short labels per tab', () => {
    expect(compactValue(-8.4, 'temperature')).toBe('-8°');
    expect(compactValue(-0.4, 'temperature')).toBe('0°');
    expect(compactValue(42.6, 'precipitation')).toBe('43%');
    expect(compactValue(140, 'precipitation')).toBe('100%');
    expect(compactValue(24.2, 'wind')).toBe('24');
  });

  it('prints nothing for a missing reading', () => {
    expect(compactValue(null, 'wind')).toBe('');
    expect(compactValue(Number.NaN, 'temperature')).toBe('');
  });
});

describe('weekdayOf', () => {
  it('names the weekday of a local date', () => {
    expect(weekdayOf('2027-01-15', 'short')).toBe('Fri');
    expect(weekdayOf('2027-01-15', 'long')).toBe('Friday');
  });

  it('is empty for an invalid date', () => {
    expect(weekdayOf('15/01/2027', 'short')).toBe('');
  });
});

describe('localParts and hoursOn', () => {
  it('agree with localDateString for every hour across both daylight-saving changes', () => {
    for (const start of ['2027-03-13T00:00:00Z', '2027-11-06T00:00:00Z']) {
      for (const hour of hoursFrom(start, 72)) {
        expect(localParts(hour.time, TORONTO)?.date).toBe(localDateString(Date.parse(hour.time), TORONTO));
      }
    }
  });

  it('reads the local hour, including the repeated 01:00 on the fall-back day', () => {
    expect(localParts('2027-11-07T05:00:00Z', TORONTO)).toEqual({ date: '2027-11-07', hour: 1 });
    expect(localParts('2027-11-07T06:00:00Z', TORONTO)).toEqual({ date: '2027-11-07', hour: 1 });
    expect(localParts('not a date', TORONTO)).toBeNull();
  });

  it('groups a regular day into 24 hours in the city’s zone', () => {
    expect(hoursOn(hoursFrom('2027-01-15T00:00:00Z', 48), '2027-01-15', TORONTO)).toHaveLength(24);
    expect(hoursOn(hoursFrom('2027-01-15T00:00:00Z', 48), '2027-01-15', 'America/Vancouver')).toHaveLength(24);
  });
});
