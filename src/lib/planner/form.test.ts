import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, planDateBounds, validatePlanForm, type PlanFormValues } from './form';

const bounds = { min: '2027-06-14', max: '2027-06-20' };
const filled: PlanFormValues = {
  activity: 'hiking', date: '2027-06-14', durationHours: '2', maxPrecipitationProbability: '30', maxWindKmh: '25',
};

describe('planDateBounds', () => {
  it("uses today in the city's zone through six days later", () => {
    // 2027-06-15T02:00Z is still June 14 in Laval (EDT) and in Vancouver (PDT).
    expect(planDateBounds(Date.parse('2027-06-15T02:00:00Z'), 'America/Toronto')).toEqual(bounds);
    expect(planDateBounds(Date.parse('2027-06-15T02:00:00Z'), 'Etc/UTC')).toEqual({ min: '2027-06-15', max: '2027-06-21' });
  });
});

describe('validatePlanForm', () => {
  it('converts valid inputs to typed criteria', () => {
    expect(validatePlanForm(filled, 'laval-qc', bounds)).toEqual({
      ok: true,
      criteria: {
        cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14',
        durationHours: 2, maxPrecipitationProbability: 30, maxWindKmh: 25,
      },
    });
  });

  it('reports every empty field with a clear message', () => {
    const result = validatePlanForm(EMPTY_FORM, 'laval-qc', bounds);
    expect(result).toEqual({
      ok: false,
      errors: {
        activity: 'Choose an activity.',
        date: 'Choose a date from 2027-06-14 to 2027-06-20.',
        durationHours: 'Enter a whole number of hours from 1 to 4.',
        maxPrecipitationProbability: 'Enter a precipitation probability from 0 to 100%.',
        maxWindKmh: 'Enter a wind speed of 0 km/h or more.',
      },
    });
  });

  it('does not treat an empty number as zero', () => {
    const result = validatePlanForm({ ...filled, maxWindKmh: '' }, 'laval-qc', bounds);
    expect(result.ok).toBe(false);
  });

  it.each([
    ['durationHours', '0'], ['durationHours', '5'], ['durationHours', '1.5'], ['durationHours', 'two'],
    ['maxPrecipitationProbability', '101'], ['maxPrecipitationProbability', '-1'],
    ['maxWindKmh', '-3'],
    ['date', '2027-06-13'], ['date', '2027-06-21'], ['date', '2027-02-30'],
    ['activity', 'swimming'],
  ] as const)('rejects %s = %s on that field only', (field, value) => {
    const result = validatePlanForm({ ...filled, [field]: value }, 'laval-qc', bounds);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual([field]);
  });

  it('accepts boundary values', () => {
    for (const values of [
      { ...filled, durationHours: '1', maxPrecipitationProbability: '0', maxWindKmh: '0', date: '2027-06-20' },
      { ...filled, durationHours: '4', maxPrecipitationProbability: '100', maxWindKmh: '12.5' },
    ]) {
      expect(validatePlanForm(values, 'laval-qc', bounds).ok).toBe(true);
    }
  });

  it('rejects a city outside the catalogue', () => {
    expect(validatePlanForm(filled, 'atlantis', bounds)).toEqual({
      ok: false, errors: { cityId: 'Choose a city from the list.' },
    });
  });
});
