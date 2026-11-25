import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, planDateBounds, validatePlanForm, type PlanFormValues } from './form';

const bounds = { min: '2027-06-14', max: '2027-06-20' };
const filled: PlanFormValues = {
  activity: 'hiking', date: '2027-06-14', durationHours: '2',
};

describe('planDateBounds', () => {
  it("uses today in the city's zone through six days later", () => {
    // 2027-06-15T02:00Z is still June 14 in Laval (EDT) and in Vancouver (PDT).
    expect(planDateBounds(Date.parse('2027-06-15T02:00:00Z'), 'America/Toronto')).toEqual(bounds);
    expect(planDateBounds(Date.parse('2027-06-15T02:00:00Z'), 'Etc/UTC')).toEqual({ min: '2027-06-15', max: '2027-06-21' });
  });
});

describe('validatePlanForm', () => {
  it('converts valid inputs to the typed request, with no thresholds', () => {
    expect(validatePlanForm(filled, 'laval-qc', bounds)).toEqual({
      ok: true,
      request: { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2 },
    });
  });

  it('sends days only for a multi-day search, and keeps it inside the horizon', () => {
    expect(validatePlanForm(filled, 'laval-qc', bounds, 3)).toEqual({
      ok: true,
      request: { cityId: 'laval-qc', activity: 'hiking', date: '2027-06-14', durationHours: 2, days: 3 },
    });
    // 19 to 21 June ends past the horizon.
    expect(validatePlanForm({ ...filled, date: '2027-06-19' }, 'laval-qc', bounds, 3))
      .toEqual({ ok: false, errors: { date: 'Choose a date from 2027-06-14 to 2027-06-20.' } });
  });

  it('reports a rejected days value on the date, where the chat can show it', () => {
    const result = validatePlanForm(filled, 'laval-qc', bounds, 4);
    expect(result).toEqual({ ok: false, errors: { date: 'Choose a date from 2027-06-14 to 2027-06-20.' } });
  });

  it('reports every empty field with a clear message', () => {
    const result = validatePlanForm(EMPTY_FORM, 'laval-qc', bounds);
    expect(result).toEqual({
      ok: false,
      errors: {
        activity: 'Choose an activity.',
        date: 'Choose a date from 2027-06-14 to 2027-06-20.',
        durationHours: 'Enter a whole number of hours from 1 to 4.',
      },
    });
  });

  it('does not treat an empty number as zero', () => {
    const result = validatePlanForm({ ...filled, durationHours: '' }, 'laval-qc', bounds);
    expect(result.ok).toBe(false);
  });

  it.each([
    ['durationHours', '0'], ['durationHours', '5'], ['durationHours', '1.5'], ['durationHours', 'two'],
    ['durationHours', '-1'],
    ['date', '2027-06-13'], ['date', '2027-06-21'], ['date', '2027-02-30'],
    ['activity', 'swimming'],
  ] as const)('rejects %s = %s on that field only', (field, value) => {
    const result = validatePlanForm({ ...filled, [field]: value }, 'laval-qc', bounds);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual([field]);
  });

  it('accepts boundary values', () => {
    for (const values of [
      { ...filled, durationHours: '1', date: '2027-06-20' },
      { ...filled, durationHours: '4' },
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
