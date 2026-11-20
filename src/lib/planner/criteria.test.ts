import { describe, expect, it } from 'vitest';
import { isCalendarDate, parsePlanCriteria } from './criteria';

const valid = {
  cityId: 'laval-qc',
  activity: 'hiking',
  date: '2027-06-14',
  durationHours: 2,
  maxPrecipitationProbability: 30,
  maxWindKmh: 25,
};

describe('parsePlanCriteria', () => {
  it('accepts the browser contract fields', () => {
    expect(parsePlanCriteria(valid)).toEqual({ ok: true, criteria: valid });
  });

  it.each(['hiking', 'cycling', 'walking'])('accepts the %s activity', activity => {
    expect(parsePlanCriteria({ ...valid, activity }).ok).toBe(true);
  });

  it.each([
    ['durationHours', 1], ['durationHours', 4],
    ['maxPrecipitationProbability', 0], ['maxPrecipitationProbability', 100],
    ['maxWindKmh', 0], ['maxWindKmh', 12.5],
  ])('accepts %s = %s', (field, value) => {
    expect(parsePlanCriteria({ ...valid, [field]: value }).ok).toBe(true);
  });

  it.each([
    ['durationHours', 0], ['durationHours', 5], ['durationHours', 1.5], ['durationHours', '2'],
    ['maxPrecipitationProbability', -1], ['maxPrecipitationProbability', 101],
    ['maxPrecipitationProbability', Number.NaN],
    ['maxWindKmh', -0.1], ['maxWindKmh', Number.POSITIVE_INFINITY], ['maxWindKmh', null],
    ['date', '2027-02-30'], ['date', '2027-6-14'], ['date', '14/06/2027'], ['date', '2027-06-14T00:00'],
    ['cityId', 'unknown'], ['cityId', 'LAVAL-QC'],
    ['activity', 'swimming'], ['activity', 'Hiking'],
  ])('rejects %s = %s and names only that field', (field, value) => {
    expect(parsePlanCriteria({ ...valid, [field]: value })).toEqual({ ok: false, fields: [field] });
  });

  it('rejects unknown fields such as free text or coordinates', () => {
    expect(parsePlanCriteria({ ...valid, note: 'free text' })).toEqual({ ok: false, fields: ['unknown_field'] });
    expect(parsePlanCriteria({ ...valid, latitude: 45 })).toEqual({ ok: false, fields: ['unknown_field'] });
  });

  it('rejects missing fields and non-objects', () => {
    const { maxWindKmh: _omit, ...missing } = valid;
    void _omit;
    expect(parsePlanCriteria(missing)).toEqual({ ok: false, fields: ['maxWindKmh'] });
    expect(parsePlanCriteria(null).ok).toBe(false);
    expect(parsePlanCriteria([valid]).ok).toBe(false);
  });

  it('does not echo rejected values', () => {
    const result = parsePlanCriteria({ ...valid, cityId: '<script>secret</script>' });
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
