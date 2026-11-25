import { describe, expect, it } from 'vitest';
import { APPROVED_THRESHOLDS, approvedThresholdPolicy, resolveThresholds } from './thresholds';
import { ACTIVITIES } from './types';

describe('approved threshold defaults (WEA-12)', () => {
  it('defines the approved maxima for each activity', () => {
    expect(APPROVED_THRESHOLDS).toEqual({
      cycling: { maxPrecipitationProbability: 20, maxWindKmh: 20 },
      hiking: { maxPrecipitationProbability: 30, maxWindKmh: 30 },
      walking: { maxPrecipitationProbability: 40, maxWindKmh: 35 },
      errands: { maxPrecipitationProbability: 30, maxWindKmh: 30 },
      other: { maxPrecipitationProbability: 30, maxWindKmh: 30 },
    });
  });

  it('covers every activity with a valid pair', () => {
    expect(Object.keys(APPROVED_THRESHOLDS).sort()).toEqual([...ACTIVITIES].sort());
    for (const activity of ACTIVITIES) {
      expect(resolveThresholds(approvedThresholdPolicy, activity)).toEqual(APPROVED_THRESHOLDS[activity]);
    }
  });

  it('orders activities from strictest to most tolerant', () => {
    const { cycling, hiking, walking } = APPROVED_THRESHOLDS;
    expect(cycling.maxPrecipitationProbability).toBeLessThan(hiking.maxPrecipitationProbability);
    expect(hiking.maxPrecipitationProbability).toBeLessThan(walking.maxPrecipitationProbability);
    expect(cycling.maxWindKmh).toBeLessThan(hiking.maxWindKmh);
    expect(hiking.maxWindKmh).toBeLessThan(walking.maxWindKmh);
  });

  it('cannot be modified at runtime', () => {
    expect(Object.isFrozen(APPROVED_THRESHOLDS)).toBe(true);
    for (const activity of ACTIVITIES) expect(Object.isFrozen(APPROVED_THRESHOLDS[activity])).toBe(true);
    expect(() => {
      (APPROVED_THRESHOLDS.hiking as { maxWindKmh: number }).maxWindKmh = 99;
    }).toThrow(TypeError);
    expect(APPROVED_THRESHOLDS.hiking.maxWindKmh).toBe(30);
  });

  it('returns a copy, so a caller cannot change the policy through the result', () => {
    const resolved = resolveThresholds(approvedThresholdPolicy, 'cycling')!;
    resolved.maxWindKmh = 99;
    expect(approvedThresholdPolicy('cycling')).toEqual({ maxPrecipitationProbability: 20, maxWindKmh: 20 });
  });
});

describe('resolveThresholds', () => {
  it.each([
    ['null', null],
    ['NaN precipitation', { maxPrecipitationProbability: Number.NaN, maxWindKmh: 20 }],
    ['precipitation above 100 %', { maxPrecipitationProbability: 101, maxWindKmh: 20 }],
    ['negative wind', { maxPrecipitationProbability: 20, maxWindKmh: -1 }],
    ['infinite wind', { maxPrecipitationProbability: 20, maxWindKmh: Number.POSITIVE_INFINITY }],
  ])('treats %s as undefined', (_name, thresholds) => {
    expect(resolveThresholds(() => thresholds, 'hiking')).toBeNull();
  });
});
