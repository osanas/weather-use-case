import { describe, expect, it } from 'vitest';
import { isCalendarDate, parsePlanRequest } from './criteria';

const valid = {
  cityId: 'laval-qc',
  activity: 'hiking',
  date: '2027-06-14',
  durationHours: 2,
};

describe('parsePlanRequest', () => {
  it('accepts the four user-selected fields and returns them without thresholds', () => {
    expect(parsePlanRequest(valid)).toEqual({ ok: true, request: valid });
  });

  it('accepts days from 1 to 3 for a flexible search and keeps them', () => {
    for (const days of [1, 2, 3]) expect(parsePlanRequest({ ...valid, days })).toEqual({ ok: true, request: { ...valid, days } });
  });

  it('rejects days outside 1–3 or not a whole number', () => {
    for (const days of [0, 4, 1.5, '3', null, -1]) {
      expect(parsePlanRequest({ ...valid, days })).toEqual({ ok: false, fields: ['days'] });
    }
  });

  it('rejects thresholds sent by the client, so the server policy cannot be overridden', () => {
    expect(parsePlanRequest({ ...valid, maxWindKmh: 100 })).toEqual({ ok: false, fields: ['unknown_field'] });
    expect(parsePlanRequest({ ...valid, maxPrecipitationProbability: 100 }))
      .toEqual({ ok: false, fields: ['unknown_field'] });
  });

  it.each(['hiking', 'cycling', 'walking'])('accepts the %s activity', activity => {
    expect(parsePlanRequest({ ...valid, activity }).ok).toBe(true);
  });

  it.each([
    ['durationHours', 1], ['durationHours', 4],
  ])('accepts %s = %s', (field, value) => {
    expect(parsePlanRequest({ ...valid, [field]: value }).ok).toBe(true);
  });

  it.each([
    ['durationHours', 0], ['durationHours', 5], ['durationHours', 1.5], ['durationHours', '2'],
    ['durationHours', Number.NaN], ['durationHours', null],
    ['date', '2027-02-30'], ['date', '2027-6-14'], ['date', '14/06/2027'], ['date', '2027-06-14T00:00'],
    ['cityId', 'unknown'], ['cityId', 'LAVAL-QC'],
    ['activity', 'swimming'], ['activity', 'Hiking'],
  ])('rejects %s = %s and names only that field', (field, value) => {
    expect(parsePlanRequest({ ...valid, [field]: value })).toEqual({ ok: false, fields: [field] });
  });

  it('rejects unknown fields such as free text or coordinates', () => {
    expect(parsePlanRequest({ ...valid, note: 'free text' })).toEqual({ ok: false, fields: ['unknown_field'] });
    expect(parsePlanRequest({ ...valid, latitude: 45 })).toEqual({ ok: false, fields: ['unknown_field'] });
  });

  it('rejects missing fields and non-objects', () => {
    const { durationHours: _omit, ...missing } = valid;
    void _omit;
    expect(parsePlanRequest(missing)).toEqual({ ok: false, fields: ['durationHours'] });
    expect(parsePlanRequest(null).ok).toBe(false);
    expect(parsePlanRequest([valid]).ok).toBe(false);
  });

  it('does not echo rejected values', () => {
    const result = parsePlanRequest({ ...valid, cityId: '<script>secret</script>' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('isCalendarDate', () => {
  it('accepts leap days only in leap years', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2027-13-01')).toBe(false);
    expect(isCalendarDate('2027-00-10')).toBe(false);
  });
});
